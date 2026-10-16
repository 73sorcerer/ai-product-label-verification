"""Print what OCR read from label images, line by line with confidence.

Run from backend/:  python ../skills/labelguard-testing/scripts/ocr_report.py <image> [<image> ...]
"""
import sys
from pathlib import Path

sys.path.insert(0, ".")  # backend/ on the path, so `app` imports

from app import ocr  # noqa: E402

LOW = 0.90  # matches the "uncertain" threshold in docs/api-contract.md

for arg in sys.argv[1:] or ["--help"]:
    if arg == "--help":
        print(__doc__)
        break
    result = ocr.extract_text(Path(arg).read_bytes())
    print(f"\n{arg}  engine={result.engine}  mean={result.mean_confidence:.3f}")
    for line in result.lines:
        flag = "  <-- low" if line.confidence < LOW else ""
        print(f"  {line.confidence:.3f}  {line.text}{flag}")
