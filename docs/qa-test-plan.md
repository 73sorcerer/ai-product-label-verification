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

## 2. Full workflow (live now)

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

For every F row also check: the **Issues** count in History equals the number of non-match fields (F9 → 2), every flagged field has its own explanation box under the table (missing ones included), and *Extracted text* lists the OCR lines with low-confidence ones dimmed.

## 2b. Sample inspection and spec management

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| S1 | Home → **Try a Sample Inspection** | Inspect opens with `granola_wrong_net_weight.png` loaded (real file name and size) and **Golden Harvest Granola** selected; the notice says it's a real sample | | |
| S2 | Press **Verify Label** on S1 | A real result: Needs Review, `net_contents` incorrect ("Net Wt 10 oz (283 g)"), a close-up crop of the net weight line; a new row appears in History | | |
| S3 | Locally with an empty database, run S1–S2 | The sample creates the Golden Harvest Granola spec once, then inspects | | |
| M1 | Specs → **New spec** → name + 2 fields → Save | The spec appears, selected, showing "2 fields • Created {today}" | | |
| M2 | ⋯ → **Duplicate as new spec** | The form opens prefilled; saving creates a second spec; the original is unchanged | | |
| M3 | ⋯ → **Delete** on a spec with no inspections | Confirm prompt, then it disappears and stays gone after reload | | |
| M4 | ⋯ → **Delete** on a spec that has inspections | Refused: "Spec has N inspection(s) in history; it can't be deleted"; the spec stays | | |
| M5 | Look for invented data anywhere | No signed-in user (the sidebar says "Demo workspace · No sign-in yet"), no "Draft/Approved", versions, reviewers or product photos on real specs | | |

## 3. History, errors and edge cases

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| H1 | Open history after F1–F9 | All 9 listed, newest first, with timestamps | | |
| H2 | Reopen one inspection from history | Same status and fields as when it ran | | |
| H3 | Reload the page / come back later | History still there (stored in the database) | | |
| E1 | Upload with no spec selected | Clear error, nothing saved | | |
| E2 | Upload a non-image | Clear error message, not a crash | | |
| E3 | Upload a phone photo > 4.5 MB | The app shows "Compressed X MB to Y MB" and the upload succeeds | | |
| E5 | Upload an iPhone photo straight from the camera roll (HEIC) | Either accepted (iOS converts it to JPEG) or a clear "Choose a PNG, JPEG…" message; never a crash | | |
| H4 | History search, date filter and pagination | Search by product or file name filters rows; "Last 7 days" hides older rows; pages move 6 rows at a time | | |
| E4 | Submit the spec form with empty fields | Validation message | | |

## 4. Devices

| # | Device / browser | Spec form | Upload (camera photo) | Results readable | History | Result |
|---|---|---|---|---|---|---|
| D1 | Desktop Chrome | | | | | |
| D2 | Desktop Safari or Firefox | | | | | |
| D3 | iPhone Safari | | | | | |
| D4 | Android Chrome | | | | | |

## 5. Real product labels

Use the local test pack (`artifacts/web-label-test-pack.zip`, **not in the repo**: brand images, testing only) and at least two photos taken with a phone. For each: create a spec from the pack's expected values, upload on **Inspect** (not the sample), confirm the verdict persists in History. Start with `cinnamon-ingredients.jpg`.

| # | Product photographed | Conditions (light, angle) | What OCR read | Verdict | Notes |
|---|---|---|---|---|---|
| P1 | | | | | |
| P2 | | | | | |

## Bug report format

File each bug as a GitHub issue labeled `qa`:
**Steps** (numbered) · **Expected** · **Actual** · **Screenshot** · **Device/browser** · **Test ID** from this plan.
