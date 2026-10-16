# QA Test Plan

**Owner:** Vincent · Issue [#6](https://github.com/Auth3nticAI/ai-product-label-verification/issues/6) · TEMPLATE: fill in the *Actual* and *Result* columns

Environment: https://ai-product-label-verification.vercel.app · Tester: ___ · Date: ___

Result key: **PASS** matches expected · **FAIL** differs (file a bug, link it) · **BLOCKED** can't run yet (e.g. route not built)

## 1. OCR on the live API (can run now)

`POST /api/ocr` from [/api/docs](https://ai-product-label-verification.vercel.app/api/docs) → "Try it out", upload each file from `data/sample_labels/`.
Expected: every printed field appears in `text`. The blurry label has low-confidence lines.

| # | File | Expected OCR | Actual (mean confidence, anything misread) | Result |
|---|---|---|---|---|
| O1 | granola_correct.png | All 7 fields read; mean ≈ 0.99 | | |
| O2 | granola_wrong_net_weight.png | Reads "Net Wt 10 oz (283 g)" | | |
| O3 | granola_missing_allergens.png | No "Contains:" line | | |
| O4 | coffee_correct.png | All 7 fields read | | |
| O5 | coffee_brand_typo.png | Reads "Peek Roasters" | | |
| O6 | coffee_wrong_best_by.png | Reads "Best By: 01/10/2026" | | |
| O7 | vitamin_correct.png | All 7 fields read | | |
| O8 | vitamin_wrong_sku.png | Reads "SKU: VC-MV-090" | | |
| O9 | vitamin_low_quality.jpg | Some lines misread with confidence < 0.90 (date ≈ "06/312028") | | |
| O10 | a .txt or .pdf file | 422 "not a readable image" | | |

## 2. Full workflow (once backend + frontend are integrated)

Create the three specs from `data/sample_labels/specs.json`, then upload each label against its spec.

| # | File | Expected status | Expected field flags | Actual | Result |
|---|---|---|---|---|---|
| F1 | granola_correct.png | Pass | all match | | |
| F2 | granola_wrong_net_weight.png | Needs Review | net_contents incorrect | | |
| F3 | granola_missing_allergens.png | Needs Review | allergens missing | | |
| F4 | coffee_correct.png | Pass | all match | | |
| F5 | coffee_brand_typo.png | Needs Review | brand incorrect | | |
| F6 | coffee_wrong_best_by.png | Needs Review | best_by incorrect | | |
| F7 | vitamin_correct.png | Pass | all match | | |
| F8 | vitamin_wrong_sku.png | Needs Review | sku incorrect | | |
| F9 | vitamin_low_quality.jpg | Needs Review | allergens + best_by **uncertain** (not incorrect) | | |

## 3. History, errors and edge cases

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| H1 | Open history after F1–F9 | All 9 listed, newest first, with timestamps | | |
| H2 | Reopen one inspection from history | Same status and fields as when it ran | | |
| H3 | Reload the page / come back later | History still there (stored in the database) | | |
| E1 | Upload with no spec selected | Clear error, nothing saved | | |
| E2 | Upload a non-image | Clear error message, not a crash | | |
| E3 | Upload a phone photo > 4.5 MB | App shrinks it first, upload succeeds | | |
| E4 | Submit the spec form with empty fields | Validation message | | |

## 4. Devices

| # | Device / browser | Spec form | Upload (camera photo) | Results readable | History | Result |
|---|---|---|---|---|---|---|
| D1 | Desktop Chrome | | | | | |
| D2 | Desktop Safari or Firefox | | | | | |
| D3 | iPhone Safari | | | | | |
| D4 | Android Chrome | | | | | |

## 5. Real phone photos (with Tray)

| # | Product photographed | Conditions (light, angle) | What OCR read | Verdict | Notes |
|---|---|---|---|---|---|
| P1 | | | | | |
| P2 | | | | | |

## Bug report format

File each bug as a GitHub issue labeled `qa`:
**Steps** (numbered) · **Expected** · **Actual** · **Screenshot** · **Device/browser** · **Test ID** from this plan.
