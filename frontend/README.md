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

API base URL: `process.env.NEXT_PUBLIC_API_URL`. Use `http://localhost:8000` locally; on Vercel it's `/api` (same origin). The local backend allows CORS from `http://localhost:3000`.

**Deployed API (works now):** https://ai-product-label-verification.vercel.app/api. Try `/api/ocr` from your UI.

**Must-do: compress images before upload.** Vercel rejects request bodies over 4.5 MB, and phone photos are often bigger. Resize to ≤ 1600 px on the long side (e.g. canvas → `toBlob('image/jpeg', 0.85)`).

**Deploying:** the frontend ships as a Vercel service in the same project; see [docs/deployment.md](../docs/deployment.md#adding-the-frontend-when-wenyi-pushes-frontend). Run `npx create-next-app@latest frontend --ts --app --eslint` from the repo root; `vercel.json` handles the rest.
