# Web label test pack

A local downloadable pack contains seven original manufacturer images for three products; downloaded 2026-10-17.
All images decode successfully and are individually under 4.5 MB. Original bytes
are preserved. Source URLs, image hashes and byte sizes are in `sources.json`.
`test-cases.json` contains eight ready-to-copy spec payloads and intended outcomes.
Images and branding belong to their respective manufacturers; this is a test
reference pack, not artwork for the VeriLabel marketing page.

## Run the real spec → upload → verdict → history process

1. Start with case 01. On Specs, create the supplied name and fields. The `spec`
   object is also the exact POST /specs payload shape for API clients.
2. Open **Inspect** (/inspect), not **Try a Sample Inspection** (/inspect?demo=1).
3. Select your new spec, upload the case's image, then press Verify Label.
4. Compare the field statuses with the target. Capture the actual OCR text and
   confidence when a correct label needs review; do not change expected text to
   conceal an OCR failure. A target pass is not a guarantee of OCR performance.
5. Open History. Find the product, open View, and confirm the saved result and
   field details match. Refresh and verify that the record is still present.
6. Run case 03 with a separate spec: its 9.37 oz expectation is intentionally
   wrong for the unchanged 2.37 oz label. Run case 05 to check missing text.
7. If a sample-data/backend-disconnected banner appears, you are using fixture
   fallback; that does not establish a real backend end-to-end pass.

## What to use

- `cinnamon-ingredients.jpg`: easy white-on-red one-field baseline; manufacturer
  label-panel artwork rather than a photographed bottle.
- `cinnamon-front.png`: product name, form, net weight on the actual package.
- `cinnamon-nutrition.jpg`: a manufacturer nutrition-panel image, for dense text.
- `cinnamon-back.jpg`: side/back packshot with rotated barcode text; challenge
  image, not an automated barcode-decoding promise.
- `kikkoman-soy-15oz.webp`: brand, product name and 15 FL OZ (444 mL). Do not
  expect the ingredients or allergens to be found on this front-only image.
- `oats-front.jpg`: Old Fashioned Rolled Oats, 32 oz (2 lb) 907g.
- `oats-back.jpg`: ingredient and nutrition panel. This image says serving size
  1/2 cup (48g); the current product-page nutrition text says 49g. Treat the
  downloaded image as the version under test, not the changing website text.

Front/back images have different visible fields; do not require every product
field from a single front-only upload. Missing text in an unpictured panel is
not an OCR defect. These downloads are unchanged real references; no artificial
misprints, cropped variants, blur or simulated labels were generated.

## Sources

- cinnamon: https://www.mccormick.com/products/mccormick-ground-cinnamon-2-37-oz
- oats: https://www.bobsredmill.com/product/regular-rolled-oats
- kikkoman: https://kikkomanusa.com/products/soy-sauce-non-gmo/soy-sauce-non-gmo-15-oz/

Local bundle: `artifacts/web-label-test-pack.zip` (downloaded reference images are not committed).

Repository references: [test cases](web-label-test-cases.json) and [source manifest](web-label-sources.json).
