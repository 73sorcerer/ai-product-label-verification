# Deployment

**Owner:** Tray (deployment + integration) · Live: **https://ai-product-label-verification.vercel.app** · API docs: [/api/docs](https://ai-product-label-verification.vercel.app/api/docs)

## Topology

One Vercel project (`tray-branch-s-projects/ai-product-label-verification`) using **Vercel Services**: each folder deploys as its own service, all shipped together in one deployment.

| Path | Service | Source |
|---|---|---|
| `/api/*` | FastAPI backend (Python, Fluid Compute) | `backend/` |
| `/*` | Next.js frontend (add when `frontend/` lands; see below) | `frontend/` |
| database | Neon Postgres `labelguard-db` (Vercel Marketplace) | env `DATABASE_URL` |

The frontend and API share one origin, so the browser makes no cross-origin calls and production needs **no CORS config**. `CORS_ORIGINS` only matters for local dev (frontend on :3000, API on :8000).

The backend gets requests at `/api/...`. A service-level rewrite in `vercel.json` strips the prefix, so FastAPI routes stay `/health`, `/specs`, and so on. `root_path="/api"` (set automatically on Vercel) keeps `/api/docs` working.

## Environment variables

| Var | Where | Value | Set by |
|---|---|---|---|
| `DATABASE_URL` | backend | Neon Postgres URL | Neon integration (automatic, all environments) |
| `NEXT_PUBLIC_API_URL` | frontend | `/api` on Vercel; `http://localhost:8000` locally | add in Vercel when the frontend lands |
| `CORS_ORIGINS` | backend, local only | `http://localhost:3000` (default) | n/a |
| `OCR_ENGINE` | backend | `rapidocr` (default) | n/a |

Never commit secrets. `vercel env pull` writes `.env.local`, which is git-ignored.

## Deploying

- **Automatic:** once GitHub is connected (see "One-time setup"), every PR gets a preview URL and every merge to `main` deploys to production.
- **Manual:** `vercel deploy` (preview) or `vercel deploy --prod` from the repo root.
- **Check it:** Actions → *Deployment check* runs the E2E suite against production after each production deploy. You can also run it by hand.

## One-time setup

Done: Vercel project linked to GitHub, Neon provisioned, `main` protected (PR + green CI required to merge).

## Adding the frontend (when Wenyi pushes `frontend/`)

Add the service and a catch-all route to `vercel.json`. The `/api` rule must stay first:

```json
{
  "services": {
    "backend": { "...unchanged..." },
    "frontend": { "root": "frontend" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "backend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ]
}
```

Then `vercel env add NEXT_PUBLIC_API_URL` with value `/api` for Production and Preview.

## Limits that affect the app

| Limit | Value | Impact |
|---|---|---|
| Request body | **4.5 MB** | Phone photos are often bigger. **The frontend must resize or compress images to under 4 MB before upload**, or Vercel returns 413 before the API sees the request. 1600 px on the long side is plenty for OCR. |
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
