# API Contract

**Owner:** Tray · **Status:** Draft for team review (Oct 14) · **Implementer:** Amzad · **Consumer:** Wenyi

The frontend and backend build against this file. If you need to change it, open a PR that edits this file first and tag the other side.

Base URL: local `http://localhost:8000`; deployed, set by Vincent through `NEXT_PUBLIC_API_URL`.
Interactive docs: `GET /docs` (FastAPI Swagger).

## Status values

| Level | Values | Meaning |
|---|---|---|
| Field | `match` | Expected value found on the label |
| | `missing` | Nothing close to the expected value found |
| | `incorrect` | A similar but different value found (e.g. `10 oz` vs `12 oz`, `Peek` vs `Peak`) |
| | `uncertain` | Looks like a match, but OCR confidence is too low to trust |
| Inspection | `pass` | Every field is `match` |
| | `needs_review` | Any field is `missing`, `incorrect` or `uncertain` |

## Endpoints

### `GET /health`
`200 {"status": "ok"}`

### `POST /ocr` (works now)
OCR only, no comparison. Wenyi can build the upload screen against it before verification is done.
- Request: `multipart/form-data` with `image` (PNG, JPEG, WEBP, BMP or TIFF; max 10 MB)
- `200` → `OcrResult`
- `422` → `{"detail": "File is not a readable image"}`, plus the empty, too-large and unsupported-format errors

### `POST /specs`
Create an approved product specification.
```json
{ "name": "Golden Harvest Granola",
  "fields": { "brand": "Sunrise Farms", "net_contents": "Net Wt 12 oz (340 g)", "allergens": "Contains: Oats, Almonds, Milk" } }
```
`201` → `ProductSpec`. `fields` is free-form: any key → expected text.

### `GET /specs` · `GET /specs/{id}`
`200` → `ProductSpec[]` / `ProductSpec`; `404` if not found.

### `POST /inspections`
Upload a label and check it against a spec.
- Request: `multipart/form-data` with `spec_id` (int) and `image` (file)
- `201` → `Inspection`
- `404` unknown spec · `422` unreadable image

### `GET /inspections?spec_id=` · `GET /inspections/{id}`
History, newest first. `200` → `Inspection[]` / `Inspection`.

## Schemas

```ts
type ProductSpec = { id: number; name: string; fields: Record<string, string>; created_at: string /* ISO 8601 UTC */ };

type OcrResult = {
  text: string;               // all lines joined with "\n", top to bottom
  lines: { text: string; confidence: number /* 0-1 */; bbox: [left, top, width, height] }[];
  mean_confidence: number;    // 0-1
  engine: "rapidocr" | "tesseract";
};

type FieldResult = {
  field: string;              // key from spec.fields
  expected: string;
  found: string | null;       // the OCR line it matched, or null
  status: "match" | "missing" | "incorrect" | "uncertain";
  confidence: number;         // 0-1
};

type Inspection = {
  id: number; spec_id: number; image_filename: string;
  status: "pass" | "needs_review";
  ocr: OcrResult; results: FieldResult[]; created_at: string;
};
```

## Python module boundary (backend-internal)

```python
# app/ocr.py (Tray)
extract_text(image_bytes: bytes) -> OcrResult      # raises OcrError

# app/verification.py (Amzad)
verify_label(ocr: OcrResult, expected: dict[str, str]) -> VerificationResult
```

### Notes for verification (measured on `data/sample_labels/`)
- Clean labels read every field exactly, with mean confidence **≈ 0.99**.
- The blurry, rotated label still reads every field, but OCR drops spaces and swaps punctuation: `60Tablets`, `Contains:Soy`, `VitaCore Health,Austin.TX`. Mean confidence falls to **≈ 0.93**. **Normalize before comparing**: lowercase, then strip whitespace and punctuation.
- A reasonable starting threshold for `uncertain` is a line confidence below **0.90**. Tune it against the samples.
- `data/sample_labels/manifest.json` lists the expected flags for each sample. Use it as test fixtures.
