# Postman: seed data and test every endpoint

**Owner:** Amzad · contract: [docs/api-contract.md](../docs/api-contract.md)

| File | What it is |
|---|---|
| `LabelGuard.postman_collection.json` | 39 requests, 125 assertions. Creates the 3 sample specs, runs an inspection for each of the 9 sample labels, and checks every error case. |
| `local.postman_environment.json` | `baseUrl = http://localhost:8000` |
| `generate_collection.py` | Rebuilds the collection from `data/sample_labels/`. Run it after adding a sample label, and don't hand-edit the JSON. |

The folders run in order: `1. Health` → `2. Specs` → `3. OCR` → `4. Inspections` → `5. History`. Later requests use ids saved by earlier ones (`{{coffee_id}}`, `{{last_inspection_id}}`), so run the whole collection rather than one request on its own.

## 1. Start the API (from `backend/`)

```bash
cd backend && .venv/bin/uvicorn app.main:app --reload
```

Data goes into `backend/labelguard.db`. Open it in DB Browser for SQLite or DBeaver to see the rows.

## 2a. Run from the command line (Postman CLI)

From the repo root:

```bash
postman collection run postman/LabelGuard.postman_collection.json -e postman/local.postman_environment.json --working-dir .
```

`--working-dir .` lets the file uploads find `data/sample_labels/*.png`. At the end it may print "Postman credentials are required for publishing run details". You can ignore that: it only means the results weren't uploaded to Postman cloud.

## 2b. Run in the Postman app

1. **Import** both JSON files (File → Import).
2. **Settings → General → Working directory**: choose this repo's root folder. Without it, every upload request fails, because Postman can't find the image files.
3. Pick the **LabelGuard local** environment (top right).
4. Right-click the collection → **Run collection** → **Run LabelGuard API**.

## What each run adds

Each run adds 4 specs (granola, coffee, vitamin, trim-test) and 9 inspections. Running it again is safe: the tests check against the ids from that run. For a clean database, stop the API, run `rm backend/labelguard.db` and start the API again.

To test the deployed site, make a copy of the environment and set `baseUrl` to `https://ai-product-label-verification.vercel.app/api`. That writes real rows to the production database, so do it once after a deploy, not in a loop.
