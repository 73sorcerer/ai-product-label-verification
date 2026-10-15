# Sample labels

**Owner:** Tray

Synthetic labels with known answers. Regenerate them with:

```bash
python data/sample_labels/generate_samples.py
```

| File | Spec | Expected |
|---|---|---|
| granola_correct.png | granola | pass |
| granola_wrong_net_weight.png | granola | needs_review: `net_contents` incorrect (10 oz) |
| granola_missing_allergens.png | granola | needs_review: `allergens` missing |
| coffee_correct.png | coffee | pass |
| coffee_brand_typo.png | coffee | needs_review: `brand` incorrect ("Peek") |
| vitamin_correct.png | vitamin | pass |
| vitamin_low_quality.png | vitamin | blurry, rotated, noisy; pass or uncertain |

- `specs.json`: approved specs. POST each one to `/specs` to seed the demo.
- `manifest.json`: machine-readable expectations for tests.

To add real photos, drop them here and add an entry to `manifest.json` by hand (don't re-run the generator afterwards, or it will overwrite the manifest).
