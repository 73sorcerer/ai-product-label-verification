---
name: labelguard-testing
description: Use when running, writing, or debugging tests for the VeriLabel product label verification app — backend unit tests, OCR accuracy checks, end-to-end tests against a local or deployed server, or adding a new sample label. Also use when a verification result looks wrong and you need to tell an OCR misread from a comparison bug.
---

# VeriLabel testing

Three test layers, cheapest first. Run them in this order and stop at the first failure.

| Layer | What it proves | Command (from repo root) |
|---|---|---|
| Unit | OCR parsing, validation, API wiring | `cd backend && pytest -q` |
| E2E local | The whole flow over HTTP | start `uvicorn app.main:app` in `backend/`, then `cd tests/e2e && pytest -q -rx` |
| E2E deployed | Same flow on the live site | `cd tests/e2e && E2E_BASE_URL=https://ai-product-label-verification.vercel.app/api pytest -q -rx` |

`xfail` in E2E output means a route still returns 501 (not built yet). That's expected until the backend routes land. A `FAILED` is a real bug.

## Is it OCR or verification?

When an inspection verdict looks wrong, check what OCR actually read before touching comparison code:

```bash
cd backend && python ../skills/labelguard-testing/scripts/ocr_report.py ../data/sample_labels/vitamin_low_quality.jpg
```

It prints every line with its confidence.
- The expected text is missing or garbled → an OCR or image-quality problem. Low confidence (< 0.90) means the field should come back `uncertain`, not `incorrect`.
- The text is right but the verdict is wrong → a verification bug in `backend/app/verification.py`.

## Adding a sample label

1. Add the product to `SPECS` and the case to `SAMPLES` in `data/sample_labels/generate_samples.py`.
2. `python data/sample_labels/generate_samples.py`
3. Run the unit tests. `test_ocr_reads_every_printed_field` must pass for the new image, or OCR can't support the case.
4. The E2E suite picks it up from `manifest.json` automatically.

For a real photo: drop it in `data/sample_labels/` and add a `manifest.json` entry by hand. Re-running the generator overwrites the manifest, so re-add the entry afterwards.

## Rules

- Never weaken, skip, or delete a test to make code pass. Fix the code. If a test is wrong, say which one and why, then stop and ask.
- OCR tests assert that text was *read*; verification tests assert that it was *judged*. Don't mix them.
- Don't loosen `manifest.json` expectations to match a buggy result. The manifest is the spec.
- Deployed E2E creates real rows in the production database. Run it against production only after a deploy, not in a loop.

## Known OCR behavior (measured, rapidocr 3.x)

- Clean labels: every field read exactly, mean confidence ≈ 0.99.
- `vitamin_low_quality.jpg`: `Contains: Soy` → `Cons usoy` (0.64); `Best By: 08/31/2028` → `Dest By: 06/312028` (0.87); `Health` → `Heath` (0.95, a confident misread).
- Cold start on Vercel: the first OCR request takes ~12 s; warm requests ~2 s.
