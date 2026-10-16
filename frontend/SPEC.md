# Frontend

**Owner:** Wenyi · STUB: scaffold with `npx create-next-app@latest . --ts --app --eslint`

Build against [docs/api-contract.md](../docs/api-contract.md). The TypeScript types there can be copied directly.

## Screens
- [ ] Spec form → `POST /specs`
- [ ] Upload label → `POST /inspections` (multipart: `spec_id`, `image`)
- [ ] Extracted text panel → `inspection.ocr.lines` (show low-confidence lines dimmed)
- [ ] Results: Pass / Needs Review + per-field status
- [ ] History → `GET /inspections`

`POST /ocr` already works. Use it to build the upload and extracted-text UI before Amzad's routes are ready.

API base URL: `process.env.NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). The backend allows CORS from `http://localhost:3000`.
