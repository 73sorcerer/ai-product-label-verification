# 0001: OCR engine: RapidOCR by default, Tesseract as fallback

- **Date:** 2026-10-14
- **Status:** Accepted
- **Approved by:** Tray (Technical Lead)

## Context
We need text plus a per-line confidence from label photos (the confidence drives the `uncertain` flag). Constraints: four teammates, mostly on Windows; six days to the demo; the backend gets deployed to public hosting by Oct 18; no budget for paid APIs.

| Option | Install | Confidence scores | Accuracy on our samples | Risk |
|---|---|---|---|---|
| **RapidOCR** (ONNX, PaddleOCR models) | `pip install` only | per line | all fields on 6/6 clean labels; ~0.99 mean conf | ~50 MB of deps; first call loads models (~1 s) |
| Tesseract (`pytesseract`) | needs a system binary on every laptop and the host image | per word | not measured (binary not installed) | Windows install friction; weaker on stylized fonts |
| EasyOCR | pip, but pulls PyTorch (~700 MB+) | per line | n/a | too heavy for free hosting tiers |
| Cloud (Google Vision, AWS Textract) | API key + billing | yes | likely best | secrets management, cost, network dependency during the live demo |

## Decision
Use **RapidOCR** by default, behind `app/ocr.py`. Keep a **Tesseract** adapter selectable with `OCR_ENGINE=tesseract`. Both return the same `OcrResult`, so nothing downstream changes.

## Consequences
- **Easier:** `pip install -r requirements.txt` is the whole setup, on any OS and any Python host. Works offline during the demo.
- **Harder:** The deploy image is larger (onnxruntime). The first request after a cold start is slower.
- **Amended 2026-10-16 by [0002](0002-hosting-vercel-neon.md):** the package is now `rapidocr` 3.x instead of `rapidocr_onnxruntime`. The old package needs desktop OpenCV, which fails on Vercel (`libxcb.so.1` missing). 3.x also ships newer models. Clean labels now score ≈ 0.99–1.00, so the "low quality" sample had to be made rougher to stay a useful test.
- **Revisit when:** real-world photos (curved bottles, glare) show poor accuracy. Then evaluate a cloud OCR behind the same interface.
