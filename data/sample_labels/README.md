# Sample labels

**Owner:** Tray

Synthetic labels with known answers, used by the OCR unit tests and the E2E suite. Regenerate them with:

```bash
python data/sample_labels/generate_samples.py
```

| File | Spec | Expected |
|---|---|---|
| granola_correct.png | granola | pass |
| granola_wrong_net_weight.png | granola | needs_review: `net_contents` incorrect (10 oz vs 12 oz) |
| granola_missing_allergens.png | granola | needs_review: `allergens` missing |
| coffee_correct.png | coffee | pass |
| coffee_brand_typo.png | coffee | needs_review: `brand` incorrect ("Peek") |
| coffee_wrong_best_by.png | coffee | needs_review: `best_by` incorrect (2026 vs 2027) |
| vitamin_correct.png | vitamin | pass |
| vitamin_wrong_sku.png | vitamin | needs_review: `sku` incorrect (VC-MV-090 vs 060) |
| vitamin_low_quality.jpg | vitamin | needs_review: correct label, bad photo; `allergens` and `best_by` **uncertain** |

- `specs.json`: the approved specs. POST each one to `/specs` to seed the demo.
- `manifest.json`: the answer key: the fields printed on each label, the expected status and the per-field flags.

`vitamin_low_quality.jpg` is the important one. OCR misreads its date as `06/312028`, with 0.87 confidence. Verification has to report that as *uncertain* (retake the photo), not *incorrect* (reject the batch). See [docs/api-contract.md](../../docs/api-contract.md).

To add real photos, drop them here and add an entry to `manifest.json` by hand (re-running the generator overwrites it).
