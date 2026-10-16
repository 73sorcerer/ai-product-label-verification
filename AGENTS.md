# AGENTS.md

Instructions for AI coding agents (Muse Code, Claude Code, Copilot, Codex) working in this repo.
Humans: see [README.md](README.md). Muse setup: [docs/muse-setup.md](docs/muse-setup.md).

## Project
LabelGuard: save an approved product label spec, upload a label photo, OCR reads it, and each field is compared to the spec. Result: **pass** or **needs_review**, with a status per field (match / missing / incorrect / uncertain). CSE 651 team project; demo Oct 20, 2026.

## Rules
- `docs/api-contract.md` is the interface authority. Don't change request/response shapes without editing that file in the same PR and saying so.
- Stay inside your owner's area (table below). If a change is needed elsewhere, describe it and stop.
- Never weaken, skip or delete a test to make code pass. Never edit `data/sample_labels/manifest.json` to match a buggy result; it's the answer key.
- Never read, print or commit secrets: `.env*`, `.vercel/`, tokens. Production config lives in Vercel.
- Don't add dependencies without saying why; the backend bundle must stay deployable on Vercel. Use `opencv-python-headless`-based packages only (desktop OpenCV crashes in production).

## Who owns what
| Area | Owner |
|---|---|
| `frontend/` | Wenyi |
| `backend/app/main.py`, `models.py`, `database.py`, `verification.py` | Amzad |
| `backend/app/ocr.py`, `data/sample_labels/`, `docs/`, `vercel.json`, `.github/workflows/` | Tray |
| `docs/qa-test-plan.md`, `docs/demo-readiness.md`, `tests/e2e/`, `skills/` | Vincent |

## Commands
Run them as written. `pytest` and `npm` can be saved as "always allow" in Muse; `python -m …` can't (interpreters aren't allowlistable).

```bash
# Backend (from backend/, venv active)
pip install -r requirements.txt
pytest -q                                   # unit tests, must pass before any PR
uvicorn app.main:app --reload --port 8000   # local API, docs at http://localhost:8000/docs

# End-to-end (API running; from tests/e2e/)
pytest -q -rx                               # xfail = route not built yet, FAILED = bug
E2E_STRICT=1 pytest -q                      # strict: unbuilt routes fail

# Frontend (from frontend/, once it exists)
npm ci && npm run lint && npm run build
```

## Git workflow
- Never commit to `main`; it's protected. Branch per task: `feature/<area>-<short-name>`.
- Commits: small and focused, with a message saying what changed and why.
- Open a PR that links its issue (`Refs #3`) and pastes test output. Three CI checks must pass: Backend unit tests, End-to-end (local server), Frontend lint + build.
- *MVP completeness* is a non-required check that stays red until every route works. That's expected.

## Before you finish a task
1. Run the backend unit tests, plus `npm run build` if you touched the frontend.
2. Append one line to `docs/ai-usage.md`: `date | who | tool | what was asked | what was kept/changed`. This is graded.
3. Summarize what you changed and anything you couldn't verify.

## Useful context
- OCR returns each line with a confidence (0–1). Below **0.90**, a mismatched field is `uncertain`, not `incorrect`. See the measured examples in `docs/api-contract.md`.
- Live API: https://ai-product-label-verification.vercel.app/api/docs. Uploads must be **< 4.5 MB** (Vercel limit); the frontend compresses photos first.
- Testing playbook: the `labelguard-testing` skill (`.agents/skills/`, same as `skills/`).
