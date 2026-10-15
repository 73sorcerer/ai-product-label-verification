# Deployment

**Owner:** Vincent · STUB

## Environment variables
| Var | Where | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | frontend | `https://<backend-host>` |
| `CORS_ORIGINS` | backend | `https://<frontend-host>` (comma-separated) |
| `DATABASE_URL` | backend | `sqlite:///./labelguard.db` (needs a persistent disk) |
| `OCR_ENGINE` | backend | `rapidocr` (default) or `tesseract` |

## Notes from OCR (Tray)
- The backend needs about 1 GB RAM: onnxruntime plus the models load into memory on the first request.
- No system packages are needed for the default engine. `OCR_ENGINE=tesseract` needs `apt-get install tesseract-ocr`.
- Upload limit in `ocr.py` is 10 MB. Make sure the host's request body limit is at least that.

## TODO(Vincent)
- [ ] Choose hosts (frontend / backend)
- [ ] Deploy steps
- [ ] Verify image upload end-to-end on the deployed site
