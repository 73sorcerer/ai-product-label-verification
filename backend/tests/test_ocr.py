"""OCR module tests.  OWNER: Tray

Fast unit tests cover parsing and validation. The sample-label tests run the real
engine against data/sample_labels/ (generate those with generate_samples.py).
"""
import io
import json
import re
from pathlib import Path

import pytest
from PIL import Image

from app import ocr

SAMPLES = Path(__file__).resolve().parents[2] / "data" / "sample_labels"
MANIFEST = SAMPLES / "manifest.json"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def png_bytes(size=(200, 100), color="white") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


# --- validation --------------------------------------------------------------


def test_rejects_empty_upload():
    with pytest.raises(ocr.OcrError, match="Empty"):
        ocr.extract_text(b"")


def test_rejects_non_image():
    with pytest.raises(ocr.OcrError, match="not a readable image"):
        ocr.extract_text(b"%PDF-1.4 definitely not a png")


def test_rejects_oversized_upload():
    with pytest.raises(ocr.OcrError, match="larger than"):
        ocr.load_image(b"0" * (ocr.MAX_IMAGE_BYTES + 1))


def test_rejects_unknown_engine(monkeypatch):
    monkeypatch.setenv("OCR_ENGINE", "magic")
    with pytest.raises(ocr.OcrError, match="Unknown OCR_ENGINE"):
        ocr.extract_text(png_bytes())


# --- preprocessing -----------------------------------------------------------


def test_preprocess_upscales_small_images_and_grayscales():
    out = ocr.preprocess(Image.new("RGB", (400, 200), "white"))
    assert out.mode == "L"
    assert out.size == (ocr.MIN_WIDTH, 500)


def test_preprocess_leaves_large_images_size_alone():
    assert ocr.preprocess(Image.new("RGB", (1600, 900))).size == (1600, 900)


# --- parsers -----------------------------------------------------------------


def test_parse_rapidocr_converts_quads_to_bboxes():
    raw = [[[[10, 20], [110, 20], [110, 50], [10, 50]], "Net Wt 12 oz", 0.97]]
    [line] = ocr.parse_rapidocr(raw)
    assert line.text == "Net Wt 12 oz"
    assert line.confidence == pytest.approx(0.97)
    assert line.bbox == (10, 20, 100, 30)


def test_parse_tesseract_groups_words_into_lines_and_skips_non_words():
    data = {
        "text":      ["",  "Contains:", "Milk", "Denver"],
        "conf":      [-1,  90,          80,     70],
        "block_num": [1,   1,           1,      1],
        "par_num":   [1,   1,           1,      1],
        "line_num":  [1,   1,           1,      2],
        "left":      [0,   10,          120,    10],
        "top":       [0,   10,          12,     60],
        "width":     [0,   100,         50,     80],
        "height":    [0,   20,          20,     20],
    }
    lines = ocr.parse_tesseract(data)
    assert [l.text for l in lines] == ["Contains: Milk", "Denver"]
    assert lines[0].confidence == pytest.approx(0.85)
    assert lines[0].bbox == (10, 10, 160, 22)


def test_build_result_orders_top_to_bottom_and_drops_blanks():
    lines = [
        ocr.OcrLine("second", 0.8, (0, 50, 10, 10)),
        ocr.OcrLine("   ", 0.1, (0, 0, 10, 10)),
        ocr.OcrLine("first", 0.6, (0, 10, 10, 10)),
    ]
    result = ocr.build_result(lines, "test")
    assert result.text == "first\nsecond"
    assert result.mean_confidence == pytest.approx(0.7)


def test_blank_image_returns_empty_result():
    result = ocr.extract_text(png_bytes())
    assert result.text == ""
    assert result.mean_confidence == 0.0


# --- real engine against sample labels -----------------------------------------

manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
needs_samples = pytest.mark.skipif(not manifest, reason="run generate_samples.py first")


@needs_samples
@pytest.mark.parametrize(
    "sample",
    [s for s in manifest if not s["degraded"]],
    ids=lambda s: s["image"],
)
def test_ocr_reads_every_printed_field(sample):
    """Every value printed on a clear label must appear in the OCR text.

    This covers the defective labels too: OCR has to read "Peek Roasters" accurately,
    or verification can't tell that it's wrong.
    """
    result = ocr.extract_text((SAMPLES / sample["image"]).read_bytes())
    text = norm(result.text)
    for field, value in sample["printed_fields"].items():
        assert norm(value) in text, f"{field}={value!r} not found in OCR text:\n{result.text}"
    assert result.mean_confidence > 0.8


@needs_samples
def test_degraded_label_flags_its_garbled_lines_as_low_confidence():
    """The blurry label is the 'uncertain' fixture: OCR must still read it, and must report low
    confidence on the lines it garbles, or verification can't tell a bad photo from a bad label."""
    clean = ocr.extract_text((SAMPLES / "vitamin_correct.png").read_bytes())
    noisy = ocr.extract_text((SAMPLES / "vitamin_low_quality.jpg").read_bytes())
    assert "vitacore" in norm(noisy.text)
    assert noisy.mean_confidence < clean.mean_confidence
    assert min(l.confidence for l in noisy.lines) < 0.9
