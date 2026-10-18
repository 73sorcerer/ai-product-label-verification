# QA Test Plan

**Owner:** Vincent · Issue [#6](https://github.com/Auth3nticAI/ai-product-label-verification/issues/6)

Environment: https://ai-product-label-verification.vercel.app (OCR and read-only API checks); isolated local API and SQLite database (workflow checks) · Tester: Vincent via Codex · Dates: Oct 17–18, 2026 UTC

Evidence scope: O1–O10 were measured against the deployed `/api/ocr` endpoint on Oct 17 using sample files from main commit `fe418ca`. On Oct 18, current main `6e838b3` passed 179/179 backend unit tests, 16/16 local API end-to-end tests (including all nine manifest verdicts and history persistence) against an isolated SQLite database, and 7/7 read-only tests against the deployed API (nine production write tests skipped). The local verdicts do **not** establish that the production UI, phone upload, or production write flow passed. Those rows remain open below.

Result key: **PASS** matches expected · **FAIL** differs (file a bug, link it) · **BLOCKED** can't run yet (e.g. route not built)

## 1. OCR on the live API (can run now)

`POST /api/ocr` from [/api/docs](https://ai-product-label-verification.vercel.app/api/docs) → "Try it out", upload each file from `data/sample_labels/`.
Expected: every printed field appears in `text`. The blurry label has low-confidence lines.

| # | File | Expected OCR | Actual (mean confidence, anything misread) | Result |
|---|---|---|---|---|
| O1 | granola_correct.png | All 7 fields read; mean ≈ 0.99 | All 7 fields read; mean 0.9972 | PASS |
| O2 | granola_wrong_net_weight.png | Reads "Net Wt 10 oz (283 g)" | Exact line read; mean 0.9946 | PASS |
| O3 | granola_missing_allergens.png | No "Contains:" line | No "Contains:" line; mean 0.9966 | PASS |
| O4 | coffee_correct.png | All 7 fields read | All 7 fields read; mean 0.9894 | PASS |
| O5 | coffee_brand_typo.png | Reads "Peek Roasters" | Exact line read; mean 0.9894 | PASS |
| O6 | coffee_wrong_best_by.png | Reads "Best By: 01/10/2026" | Exact line read; mean 0.9897 | PASS |
| O7 | vitamin_correct.png | All 7 fields read | All 7 fields read; mean 0.9993 | PASS |
| O8 | vitamin_wrong_sku.png | Reads "SKU: VC-MV-090" | Exact line read; mean 0.9993 | PASS |
| O9 | vitamin_low_quality.jpg | Some lines misread with confidence < 0.90 (date ≈ "06/312028") | Mean 0.8732; `Cons usoy` 0.6408, `Dest By: 06/312028` 0.8695, `VitaCore Heath` 0.9527 | PASS |
| O10 | a .txt or .pdf file | 422 "not a readable image" | A plain-text file returned HTTP 422, `File is not a readable image` | PASS |

## 2. Full workflow (live now)

Create the three specs from `data/sample_labels/specs.json`, then upload each label against its spec.

Local automated evidence: F1–F9 matched `data/sample_labels/manifest.json` on Oct 18; inspection history persisted and could be read back. Production UI results, per-field explanation boxes, Issues counts, and image evidence crops were not exercised in this pass, so the live rows remain unscored.

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

## 6. Pricing and billing (Stripe test mode)

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| B1 | Open **Pricing** from the nav | 3 plans: Starter $49, Professional $149 (Most popular), Enterprise $499; limits listed; "14-day free trial" | | |
| B2 | Toggle **Annual** | Prices show per-month equivalent ($40.83 / $124.17 / $415.83) billed annually, "2 months free" | | |
| B3 | Professional → **Start 14-day trial** → card 4242 4242 4242 4242 | Stripe Checkout opens; after paying you land on "Confirming your subscription…", then "You're on Professional" within seconds | | |
| B4 | Sidebar after B3 | Plan badge "Professional · Trial" + **Manage billing** | | |
| B5 | **Manage billing** | Stripe Customer Portal opens for this subscription; switch plan / cancel works; badge updates after returning | | |
| B6 | Try **Start trial** again while subscribed | Message to use Manage billing; no second checkout | | |
| B7 | Card 4000 0025 0000 3155 | 3-D Secure challenge, then success | | |
| B8 | Cancel on the Stripe Checkout page | Back on /pricing, nothing changed | | |
| B9 | Clear cookies, open the success page | No plan shown (the subscription stays in Stripe; known limitation: no accounts) | | |

## Bug report format

File each bug as a GitHub issue labeled `qa`:
**Steps** (numbered) · **Expected** · **Actual** · **Screenshot** · **Device/browser** · **Test ID** from this plan.
