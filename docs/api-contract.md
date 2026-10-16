# API Contract

**Owner:** Tray · **Status:** Draft for team review (Oct 14) · **Implementer:** Amzad · **Consumer:** Wenyi

The frontend and backend build against this file. If you need to change it, open a PR that edits this file first and tag the other side.

Base URL: local `http://localhost:8000` · deployed **`https://ai-product-label-verification.vercel.app/api`** (frontend uses `NEXT_PUBLIC_API_URL=/api`, same origin).
Interactive docs: `/docs` locally · [/api/docs](https://ai-product-label-verification.vercel.app/api/docs) deployed.
**Uploads must be under 4.5 MB on Vercel.** The frontend should resize photos (≤ 1600 px long side) before sending.

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
`200 {"status": "ok", "database": "sqlite" | "postgresql"}` · `503` if the database is unreachable

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

### Notes for verification (measured Oct 16 on `data/sample_labels/`, rapidocr 3.x)
- Every label has 7 fields: `brand`, `product_name`, `net_contents`, `allergens`, `sku`, `best_by`, `manufacturer`. Spec values include their printed prefix (`"SKU: SF-GRN-12"`, `"Best By: 03/15/2027"`).
- Clean labels: every field read exactly, line confidence **0.97–1.00**.
- `vitamin_low_quality.jpg` is a **correct** label in a bad photo. OCR returns:

  | Line | Read as | Confidence | Must be |
  |---|---|---|---|
  | `Contains: Soy` | `Cons usoy` | 0.64 | `uncertain` |
  | `Best By: 08/31/2028` | `Dest By: 06/312028` | 0.87 | `uncertain`, **not** `incorrect` |
  | `VitaCore Health, Austin, TX` | `VitaCore Heath, Austin, TX` | 0.95 | `incorrect` is an acceptable false alarm |

  So: **check confidence before calling a mismatch `incorrect`**. Below **0.90** → `uncertain`. Otherwise a blurry photo of a good label reports a wrong expiry date.
- **Normalize before comparing**: lowercase, strip whitespace and punctuation (OCR drops spaces such as `Contains:Soy`).
- `data/sample_labels/manifest.json` is the answer key, and `tests/e2e/` checks every sample against it.
