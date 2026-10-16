# 0002: Host on Vercel (Services) with Neon Postgres

- **Date:** 2026-10-16
- **Status:** Accepted
- **Approved by:** Tray (Technical Lead), on behalf of DevOps

## Context
The app must be public by Oct 18. It has a Next.js frontend, a Python backend with a ~250 MB OCR dependency stack, and needs inspection history that survives restarts. SQLite on a serverless host doesn't persist: the file system is read-only except `/tmp`, which isn't shared between instances.

## Decision
- **One Vercel project, two services** (`backend/` FastAPI, `frontend/` Next.js), routed by path: `/api/*` → backend, everything else → frontend.
- **Neon Postgres** via the Vercel Marketplace for production data. SQLite stays the local default; `database.py` picks the engine from `DATABASE_URL`.
- **OCR on `rapidocr` 3.x** (amends [0001](0001-ocr-engine.md)): it uses headless OpenCV, so it runs without system graphics libraries.

## Consequences
- **Easier:** one URL, same origin (no CORS in production), one deploy, preview URL per PR, env vars injected automatically.
- **Harder:** 4.5 MB request limit, so the frontend must compress photos. Cold starts take ~12 s on the first OCR call.
- **Revisit when:** cold starts hurt the demo (warm up first), or uploads routinely exceed 4.5 MB (switch to direct Vercel Blob uploads).
