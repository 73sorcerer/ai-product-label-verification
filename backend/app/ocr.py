"""OCR text extraction for uploaded product label images.

OWNER: Tray

Public API (the contract other modules rely on; see docs/api-contract.md):
    extract_text(image_bytes) -> OcrResult
    OcrError

Engines (pick with the OCR_ENGINE env var):
    rapidocr   (default) pip-only, ONNX models, no system binary needed
    tesseract  needs the tesseract binary; set TESSERACT_CMD if it's not on PATH
See docs/adr/0001-ocr-engine.md for why.
"""
from __future__ import annotations

import io
import os
from dataclasses import dataclass, field
from functools import lru_cache

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MIN_WIDTH = 1000  # small images are upscaled; both engines miss small glyphs
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP", "BMP", "TIFF"}


class OcrError(Exception):
    """The image could not be read or OCR failed. The API maps this to HTTP 422."""


@dataclass
class OcrLine:
    text: str
    confidence: float  # 0.0 to 1.0
    bbox: tuple[int, int, int, int]  # left, top, width, height in original-image pixels (EXIF-rotated)


@dataclass
class OcrResult:
    text: str  # every line joined with "\n", top-to-bottom
    lines: list[OcrLine] = field(default_factory=list)
    mean_confidence: float = 0.0
    engine: str = ""

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "lines": [
                {"text": l.text, "confidence": round(l.confidence, 4), "bbox": list(l.bbox)}
                for l in self.lines
            ],
            "mean_confidence": round(self.mean_confidence, 4),
            "engine": self.engine,
        }


def extract_text(image_bytes: bytes) -> OcrResult:
    original = load_image(image_bytes)
    image = preprocess(original)
    engine = os.getenv("OCR_ENGINE", "rapidocr").lower()
    if engine == "rapidocr":
        lines = _run_rapidocr(image)
    elif engine == "tesseract":
        lines = _run_tesseract(image)
    else:
        raise OcrError(f"Unknown OCR_ENGINE: {engine}")
    # preprocess() may upscale; report boxes in the uploaded image's own pixels (after EXIF
    # rotation, which is how browsers display it) so clients can crop or overlay directly.
    oriented_width = ImageOps.exif_transpose(original).width
    return build_result(scale_lines(lines, oriented_width / image.width), engine)


def load_image(image_bytes: bytes) -> Image.Image:
    if not image_bytes:
        raise OcrError("Empty upload")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise OcrError(f"Image larger than {MAX_IMAGE_BYTES // (1024 * 1024)} MB")
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except (UnidentifiedImageError, OSError) as e:
        raise OcrError("File is not a readable image") from e
    if image.format not in ALLOWED_FORMATS:
        raise OcrError(f"Unsupported image format: {image.format}")
    return image


def preprocess(image: Image.Image) -> Image.Image:
    """Fix phone-camera rotation, flatten to grayscale, upscale small images, stretch contrast."""
    image = ImageOps.exif_transpose(image)
    image = image.convert("L")
    if image.width < MIN_WIDTH:
        scale = MIN_WIDTH / image.width
        image = image.resize((MIN_WIDTH, round(image.height * scale)), Image.LANCZOS)
    return ImageOps.autocontrast(image, cutoff=1)


def scale_lines(lines: list[OcrLine], factor: float) -> list[OcrLine]:
    if factor == 1:
        return lines
    return [
        OcrLine(l.text, l.confidence, tuple(round(v * factor) for v in l.bbox))
        for l in lines
    ]


def build_result(lines: list[OcrLine], engine: str) -> OcrResult:
    lines = [l for l in lines if l.text.strip()]
    lines.sort(key=lambda l: (l.bbox[1], l.bbox[0]))
    mean = sum(l.confidence for l in lines) / len(lines) if lines else 0.0
    return OcrResult(
        text="\n".join(l.text.strip() for l in lines),
        lines=lines,
        mean_confidence=mean,
        engine=engine,
    )


# --- engine adapters -------------------------------------------------------


@lru_cache(maxsize=1)
def _rapidocr_engine():
    # Loading the ONNX models takes about 1 s, so do it once per process.
    # rapidocr 3.x bundles its models in the wheel and uses headless OpenCV (no libGL/libxcb),
    # which is what lets it run on Vercel. Don't switch back to rapidocr_onnxruntime.
    from rapidocr import RapidOCR

    return RapidOCR(params={"Global.log_level": "warning"})


def _run_rapidocr(image: Image.Image) -> list[OcrLine]:
    import numpy as np

    try:
        out = _rapidocr_engine()(np.array(image.convert("RGB")))
    except Exception as e:  # the engine raises assorted types on bad input
        raise OcrError(f"RapidOCR failed: {e}") from e
    if out.boxes is None:  # nothing detected
        return []
    return parse_rapidocr(list(zip(out.boxes.tolist(), out.txts, out.scores)))


def parse_rapidocr(result: list) -> list[OcrLine]:
    """RapidOCR returns [[quad_points, text, score], ...] with quad_points as 4 (x, y) pairs."""
    lines = []
    for points, text, score in result:
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        left, top = int(min(xs)), int(min(ys))
        lines.append(
            OcrLine(text, float(score), (left, top, int(max(xs)) - left, int(max(ys)) - top))
        )
    return lines


def _run_tesseract(image: Image.Image) -> list[OcrLine]:
    try:
        import pytesseract

        if cmd := os.getenv("TESSERACT_CMD"):
            pytesseract.pytesseract.tesseract_cmd = cmd
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    except Exception as e:
        raise OcrError(f"Tesseract failed: {e}") from e
    return parse_tesseract(data)


def parse_tesseract(data: dict) -> list[OcrLine]:
    """Group Tesseract's word boxes into lines. conf is 0-100, and -1 marks non-word boxes."""
    groups: dict[tuple, list[int]] = {}
    for i, word in enumerate(data["text"]):
        if not str(word).strip() or float(data["conf"][i]) < 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        groups.setdefault(key, []).append(i)

    lines = []
    for idxs in groups.values():
        left = min(data["left"][i] for i in idxs)
        top = min(data["top"][i] for i in idxs)
        right = max(data["left"][i] + data["width"][i] for i in idxs)
        bottom = max(data["top"][i] + data["height"][i] for i in idxs)
        conf = sum(float(data["conf"][i]) for i in idxs) / len(idxs) / 100
        text = " ".join(str(data["text"][i]) for i in idxs)
        lines.append(OcrLine(text, conf, (left, top, right - left, bottom - top)))
    return lines
