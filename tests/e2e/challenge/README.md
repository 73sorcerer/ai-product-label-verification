# Real product photo challenge set

This set adds **11 unchanged Open Food Facts photos** and **18 human-annotated cases** for VeriLabel QA. Four products contribute clean front controls and difficult original views: tiny ingredients, curved cans and jars, glare, rotated text, blur, low light, a clipped logo, and multilingual panels. Seven cases reuse an unchanged image with a deliberately wrong or absent spec field. No label text was edited to manufacture a mismatch.

## Rights and provenance

The photos come from [Open Food Facts](https://world.openfoodfacts.org/data), which states that product images are available under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.en). Credit: **Open Food Facts contributors**. Each file's source image URL, product page, barcode, SHA256, and byte size is recorded in [sources.json](sources.json). The photos are included unchanged; this directory's photos are licensed separately from any repository code. Open Food Facts cautions that product packaging may contain graphical elements subject to other rights. Use these photos for the course QA task; do not treat them as marketing artwork.

The `image_ingredients_url` for Nutella barcode `3017620422003` returns a low-light **front** photo, not an ingredients panel. Human inspection, not the database view tag, establishes the answer key. The duplicate nutrition URL was excluded.

## Ground truth

[cases.json](cases.json) records the text visibly present or absent in each original image, the spec sent to the API, the expected verdict and field status, difficulty tags, and whether the case is a visible match, a genuine spec mismatch, or an unreadable/absent field. These were set after visual inspection of the downloaded pixels. The expectation is **not** adjusted to the OCR response. In a wrong-spec case, the image is exactly the same bytes as its control. A field that cannot be read should be missing or uncertain, rather than called an actual label error.

## Reproduce

Run `python tests/e2e/challenge/download_off.py` from the repo root to verify or re-download all pinned images. Start the backend on `127.0.0.1:8767` with a **temporary SQLite `DATABASE_URL`**. Then run `python tests/e2e/challenge/run_challenge.py`. The runner refuses non-loopback targets and writes [results.json](results.json). It creates 18 local specs and inspections, checks saved details and filtered History, and records actual OCR text and field evidence. It exits successfully when the HTTP workflow persists even if the model fails the human answer key; the printed summary and JSON expose those failures.

## Measured on Oct 18, 2026

With local branch `feature/qa-sample-results`, the 18 real-photo cases yielded **14/18 expected overall verdicts**, **11/18 exact field-status maps**, and **18/18 persisted inspections**. The four verdict misses were B04, H01, H05, and N01. The additional field-status misses were B02, C01, and H04. See `results.json` for every OCR line, found value, confidence, and expected-versus-actual status.

Notable failures: B04 read the correct nutrition basis as `g 100` and marked expected `100 g` incorrect; H01 marked the correctly printed `HEINZ` uncertain and read the `O` in `14 OZ` as zero; H05 OCR contained `Porción: 12 g` but the verifier selected another `Porción` line; N01 read stylized `nutella` as `Inutelal`. These are observed QA findings, not corrected answer keys. The existing simple manufacturer test pack's eight expected verdicts still pass locally.
