# Deployment

**Owner:** Tray (deployment + integration) · Live: **https://ai-product-label-verification.vercel.app** · API docs: [/api/docs](https://ai-product-label-verification.vercel.app/api/docs)

## Topology

One Vercel project (`tray-branch-s-projects/ai-product-label-verification`) using **Vercel Services**: each folder deploys as its own service, all shipped together in one deployment.

| Path | Service | Source |
|---|---|---|
| `/api/*` | FastAPI backend (Python, Fluid Compute) | `backend/` |
| `/*` | Next.js frontend | `frontend/` |
| database | Neon Postgres `labelguard-db` (Vercel Marketplace) | env `DATABASE_URL` |

The frontend and API share one origin, so the browser makes no cross-origin calls and production needs **no CORS config**. `CORS_ORIGINS` only matters for local dev (frontend on :3000, API on :8000).

The backend gets requests at `/api/...`. A service-level rewrite in `vercel.json` strips the prefix, so FastAPI routes stay `/health`, `/specs`, and so on. `root_path="/api"` (set automatically on Vercel) keeps `/api/docs` working.

## Environment variables

| Var | Where | Value | Set by |
|---|---|---|---|
| `DATABASE_URL` | backend | Neon Postgres URL | Neon integration (automatic, all environments) |
| `NEXT_PUBLIC_API_URL` | frontend | optional override; defaults to `/api` (production) or `http://localhost:8000` (dev) | n/a |
| `CORS_ORIGINS` | backend, local only | `http://localhost:3000` (default) | n/a |
| `OCR_ENGINE` | backend | `rapidocr` (default) | n/a |

Never commit secrets. `vercel env pull` writes `.env.local`, which is git-ignored.

## Deploying

- **Automatic:** once GitHub is connected (see "One-time setup"), every PR gets a preview URL and every merge to `main` deploys to production.
- **Manual:** `vercel deploy` (preview) or `vercel deploy --prod` from the repo root.
- **Check it:** after each merge to `main`, Actions → *Deployment check* waits until `/api/health` reports the new commit, then runs the E2E suite against production. You can also run it by hand.

## One-time setup

Done: Vercel project linked to GitHub, Neon provisioned, `main` protected (PR + green CI required to merge).

## Frontend service (added with PR #10)

`vercel.json` routes `/api/*` to the backend and everything else to the Next.js app in `frontend/`. The `/api` rule must stay first.
The frontend picks its API address automatically: `/api` in production builds, `http://localhost:8000` in `npm run dev`. Set `NEXT_PUBLIC_API_URL` only to override that.

## Limits that affect the app

| Limit | Value | Impact |
|---|---|---|
| Request body | **4.5 MB** | Phone photos are often bigger. The upload page resizes photos to 1600 px on the long side and re-compresses until under 4 MB (`frontend/src/lib/image.ts`). Without that, Vercel returns 413 before the API sees the request. |
| Cold start | ~12 s on the first OCR call | The ONNX models load once per instance. Hit `/api/health` and one `/api/ocr` call before the demo. |
| Warm OCR | ~2 s | n/a |
| Function bundle | ~250 MB (OpenCV, onnxruntime, models, numpy) | Well under Vercel's 5 GB limit |

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `libxcb.so.1` / `libGL.so.1` missing | Something installed the desktop `opencv-python`. Use `rapidocr>=3` (pulls `opencv-python-headless`); never `rapidocr_onnxruntime`. |
| `/api/health` returns 503 | Database unreachable. Check `DATABASE_URL` in Vercel → Settings → Environment Variables. |
| 413 on upload | Image over 4.5 MB; compress on the client. |
| `/api/docs` blank | `root_path` not set: the `VERCEL` env var is missing (only happens outside Vercel). |
| History disappears | Running on SQLite fallback; `DATABASE_URL` not set for that environment. |
