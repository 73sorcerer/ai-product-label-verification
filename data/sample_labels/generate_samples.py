"""Generate synthetic product label images plus their expected verification outcomes.

OWNER: Tray

Run from the repo root:  python data/sample_labels/generate_samples.py
Writes: data/sample_labels/*.png, specs.json (approved specs), manifest.json (expected results)

Each label has a correct version and one or more defective versions, so OCR and
verification can be tested against known answers. Real photos of labels can be
dropped in this folder too; add them to manifest.json by hand.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).parent
W, H = 1200, 800

SPECS = {
    "granola": {
        "name": "Golden Harvest Granola",
        "fields": {
            "brand": "Sunrise Farms",
            "product_name": "Golden Harvest Granola",
            "net_contents": "Net Wt 12 oz (340 g)",
            "allergens": "Contains: Oats, Almonds, Milk",
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
            "manufacturer": "VitaCore Health, Austin, TX",
        },
    },
}

# (file stem, spec id, field overrides, post-processing, expected field flags)
# overrides: None removes the field from the label; a string replaces its value.
SAMPLES = [
    ("granola_correct", "granola", {}, None, {}),
    ("granola_wrong_net_weight", "granola", {"net_contents": "Net Wt 10 oz (283 g)"}, None,
     {"net_contents": "incorrect"}),
    ("granola_missing_allergens", "granola", {"allergens": None}, None,
     {"allergens": "missing"}),
    ("coffee_correct", "coffee", {}, None, {}),
    ("coffee_brand_typo", "coffee", {"brand": "Peek Roasters"}, None,
     {"brand": "incorrect"}),
    ("vitamin_correct", "vitamin", {}, None, {}),
    # Degraded photo: text is all there but OCR confidence drops. Treat any flags as acceptable.
    ("vitamin_low_quality", "vitamin", {}, "degrade", {"*": "uncertain_or_match"}),
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
    layout = [
        ("brand", font(44, bold=True)),
        ("product_name", font(64, bold=True)),
        ("net_contents", font(40)),
        ("allergens", font(36)),
        ("manufacturer", font(30)),
    ]
    for key, f in layout:
        value = fields.get(key)
        if value:
            d.text((70, y), value, font=f, fill=(20, 20, 20))
        y += f.size + 70 if key == "product_name" else f.size + 50

    d.text((70, H - 90), "Store in a cool, dry place.", font=font(26), fill=(90, 90, 90))
    return img


def degrade(img: Image.Image) -> Image.Image:
    rnd = random.Random(651)  # fixed seed, so the output is the same on every run
    img = img.rotate(3, expand=False, fillcolor=(250, 246, 236))
    img = img.filter(ImageFilter.GaussianBlur(2.2))
    px = img.load()
    for _ in range(25000):
        x, y = rnd.randrange(W), rnd.randrange(H)
        v = rnd.randrange(120, 255)
        px[x, y] = (v, v, v)
    small = img.resize((W // 2, H // 2))
    return small


def main() -> None:
    (OUT / "specs.json").write_text(json.dumps(SPECS, indent=2) + "\n")

    manifest = []
    for stem, spec_id, overrides, post, flags in SAMPLES:
        fields: dict[str, str | None] = {**SPECS[spec_id]["fields"], **overrides}
        img = render(fields)
        if post == "degrade":
            img = degrade(img)
        filename = f"{stem}.png"
        img.save(OUT / filename)

        expected_status = "pass" if not flags else "needs_review"
        if flags == {"*": "uncertain_or_match"}:
            expected_status = "pass_or_needs_review"
        manifest.append({
            "image": filename,
            "spec_id": spec_id,
            "printed_fields": {k: v for k, v in fields.items() if v},
            "expected_status": expected_status,
            "expected_flags": flags,
        })

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(manifest)} labels to {OUT}")


if __name__ == "__main__":
    main()
