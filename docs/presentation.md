# Final Presentation (Oct 20)

**Owner:** Tray · Rehearsal: Oct 19

| # | Section | Speaker | Time |
|---|---|---|---|
| 1 | Problem: label errors (wrong net weight, missing allergens) cause recalls; manual checks are slow | Tray | 1 min |
| 2 | Live demo (script below) | Tray + Wenyi | 4 min |
| 3 | Architecture and API contract | Tray | 1.5 min |
| 4 | Verification engine: match / missing / incorrect / uncertain | Amzad | 1.5 min |
| 5 | CI/CD and deployment | Vincent | 1 min |
| 6 | AI-assisted development: what we delegated, what we reviewed, the reusable Skill | All | 2 min |
| 7 | Limits and next steps | Tray | 1 min |

## Demo script (deployed URL)
1. Create spec **Golden Harvest Granola** (values from `data/sample_labels/specs.json`).
2. Upload `granola_correct.png` → **Pass**, all fields green.
3. Upload `granola_wrong_net_weight.png` → **Needs Review**, `net_contents` incorrect (10 oz vs 12 oz).
4. Upload `granola_missing_allergens.png` → **Needs Review**, `allergens` missing.
5. Upload `vitamin_low_quality.png` → shows lower OCR confidence and/or `uncertain`.
6. Open **History** → all four inspections with timestamps.
7. Show a green GitHub Actions run and a merged PR.

**Fallback:** if the deployed site is down, run locally (`uvicorn` + `npm run dev`) with the same script. Keep screenshots of each step in `docs/demo/` as a last resort.

## Dry-run checklist
- [ ] Deployed URL loads on a phone
- [ ] All demo images on the presenting laptop
- [ ] Cold start warmed up (hit `/health` 2 min before)
