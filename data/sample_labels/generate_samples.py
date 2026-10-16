"""Generate synthetic product label images plus their expected verification outcomes.

OWNER: Tray

Run from the repo root:  python data/sample_labels/generate_samples.py
Writes: data/sample_labels/*.png|jpg, specs.json (approved specs), manifest.json (expected results)

Each product has a correct label and one or more defective ones, so OCR and verification
can be tested against known answers. To add real photos, put them in this folder and add
them to manifest.json by hand (re-running this script overwrites manifest.json).
"""
from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).parent
W, H = 1200, 900

SPECS = {
    "granola": {
        "name": "Golden Harvest Granola",
        "fields": {
            "brand": "Sunrise Farms",
            "product_name": "Golden Harvest Granola",
            "net_contents": "Net Wt 12 oz (340 g)",
            "allergens": "Contains: Oats, Almonds, Milk",
            "sku": "SKU: SF-GRN-12",
            "best_by": "Best By: 03/15/2027",
            "manufacturer": "Sunrise Farms Co., Portland, OR",
        },
    },
    "coffee": {
        "name": "Peak Cold Brew",
        "fields": {
            "brand": "Peak Roasters",
            "product_name": "Cold Brew Coffee",
            "net_contents": "16 FL OZ (473 mL)",
            "allergens": "Contains: Milk",
            "sku": "SKU: PR-CB-16",
            "best_by": "Best By: 01/10/2027",
            "manufacturer": "Peak Roasters LLC, Denver, CO",
        },
    },
    "vitamin": {
        "name": "VitaCore Daily Multivitamin",
        "fields": {
            "brand": "VitaCore",
            "product_name": "Daily Multivitamin",
            "net_contents": "60 Tablets",
            "allergens": "Contains: Soy",
            "sku": "SKU: VC-MV-060",
            "best_by": "Best By: 08/31/2028",
            "manufacturer": "VitaCore Health, Austin, TX",
        },
    },
}

# (file name, spec id, field overrides, degrade?, expected field flags)
# overrides: None removes the field from the label; a string replaces its value.
SAMPLES = [
    ("granola_correct.png", "granola", {}, False, {}),
    ("granola_wrong_net_weight.png", "granola", {"net_contents": "Net Wt 10 oz (283 g)"}, False,
     {"net_contents": "incorrect"}),
    ("granola_missing_allergens.png", "granola", {"allergens": None}, False,
     {"allergens": "missing"}),
    ("coffee_correct.png", "coffee", {}, False, {}),
    ("coffee_brand_typo.png", "coffee", {"brand": "Peek Roasters"}, False,
     {"brand": "incorrect"}),
    ("coffee_wrong_best_by.png", "coffee", {"best_by": "Best By: 01/10/2026"}, False,
     {"best_by": "incorrect"}),
    ("vitamin_correct.png", "vitamin", {}, False, {}),
    ("vitamin_wrong_sku.png", "vitamin", {"sku": "SKU: VC-MV-090"}, False,
     {"sku": "incorrect"}),
    # Blurry, low-res, noisy JPEG of a CORRECT label. OCR garbles some lines with low confidence
    # (allergens 0.64, best_by 0.87 reads "06/312028"), so those must be "uncertain", not "incorrect".
    ("vitamin_low_quality.jpg", "vitamin", {}, True,
     {"allergens": "uncertain", "best_by": "uncertain"}),
]

NOTES = {
    "vitamin_low_quality.jpg": "manufacturer reads 'VitaCore Heath' at 0.95 confidence; flagging it "
    "incorrect is an acceptable false alarm (status is needs_review either way).",
}

LAYOUT = [  # field, font size, bold, space after
    ("brand", 44, True, 40),
    ("product_name", 64, True, 60),
    ("net_contents", 40, False, 40),
    ("allergens", 36, False, 40),
    ("sku", 30, False, 30),
    ("best_by", 30, False, 40),
    ("manufacturer", 30, False, 40),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = ["arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["arial.ttf", "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def render(fields: dict[str, str | None]) -> Image.Image:
    img = Image.new("RGB", (W, H), (250, 246, 236))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, W - 20, H - 20], outline=(60, 60, 60), width=4)

    y = 60
    for key, size, bold, gap in LAYOUT:
        if value := fields.get(key):
            d.text((70, y), value, font=font(size, bold), fill=(20, 20, 20))
        y += size + gap  # keep the gap when a field is missing, like a real misprint

    d.text((70, H - 90), "Store in a cool, dry place.", font=font(26), fill=(90, 90, 90))
    return img


def degrade(img: Image.Image) -> Image.Image:
    """Simulate a bad phone photo. Settings were tuned so OCR drops below ~0.7 confidence on
    some lines; the OCR models read anything milder perfectly."""
    rnd = random.Random(651)  # fixed seed, so the output is the same on every run
    img = img.rotate(3, fillcolor=(250, 246, 236)).filter(ImageFilter.GaussianBlur(3.0))
    px = img.load()
    for _ in range(20000):
        v = rnd.randrange(120, 255)
        px[rnd.randrange(W), rnd.randrange(H)] = (v, v, v)
    return img.resize((W // 3, H // 3))


def main() -> None:
    (OUT / "specs.json").write_text(json.dumps(SPECS, indent=2) + "\n")

    manifest = []
    for filename, spec_id, overrides, degraded, flags in SAMPLES:
        fields: dict[str, str | None] = {**SPECS[spec_id]["fields"], **overrides}
        img = render(fields)
        if degraded:
            degrade(img).save(OUT / filename, "JPEG", quality=40)
        else:
            img.save(OUT / filename)

        manifest.append({
            "image": filename,
            "spec_id": spec_id,
            "printed_fields": {k: v for k, v in fields.items() if v},
            "degraded": degraded,
            "expected_status": "needs_review" if flags else "pass",
            "expected_flags": flags,
            **({"notes": NOTES[filename]} if filename in NOTES else {}),
        })

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(manifest)} labels to {OUT}")


if __name__ == "__main__":
    main()
