"""Compare OCR-extracted label text against an approved product specification.

OWNER: Amzad. STUB: signatures and result shape are fixed by docs/api-contract.md.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.ocr import OcrResult

# Field-level statuses
MATCH = "match"
MISSING = "missing"
INCORRECT = "incorrect"
UNCERTAIN = "uncertain"

# Overall statuses
PASS = "pass"
NEEDS_REVIEW = "needs_review"


@dataclass
class FieldResult:
    field: str
    expected: str
    found: str | None
    status: str  # match | missing | incorrect | uncertain
    confidence: float  # 0.0 to 1.0


@dataclass
class VerificationResult:
    status: str  # pass | needs_review
    fields: list[FieldResult] = field(default_factory=list)


def verify_label(ocr: OcrResult, expected: dict[str, str]) -> VerificationResult:
    """Return one FieldResult per key in `expected`.

    TODO(Amzad):
      - normalize text (case, whitespace, punctuation, unit spellings like "fl oz" / "FL. OZ.")
      - fuzzy-match each expected value against ocr.lines (e.g. difflib or rapidfuzz)
      - MISSING if nothing close; INCORRECT if a near-but-different value is found;
        UNCERTAIN if it matched but the line's confidence is low (see ocr.OcrLine.confidence)
      - overall PASS only if every field is MATCH
      - test cases: data/sample_labels/manifest.json lists the expected flags per sample
    """
    raise NotImplementedError("verify_label not implemented yet")
