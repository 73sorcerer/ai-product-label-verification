# AI Product Label Verification

CSE 651 (Software Development with Agentic AI) · Demo: **Oct 20, 2026**

**Live:** https://ai-product-label-verification.vercel.app · [API docs](https://ai-product-label-verification.vercel.app/api/docs)

Save an approved product label spec, upload a photo of the printed label, and get **Pass** or **Needs Review**, with the reason for each field (missing, incorrect, or uncertain).

## Team
| Who | Role | Owns |
|---|---|---|
| Tray | Tech lead / OCR / deployment | `backend/app/ocr.py`, `data/sample_labels/`, `docs/`, `vercel.json`, `.github/workflows/` |
| Wenyi | Frontend | `frontend/` |
| Amzad | Backend | `backend/app/{main,models,database,verification}.py` |
| Vincent | QA / demo readiness | `docs/qa-test-plan.md`, `docs/demo-readiness.md`, `tests/e2e/`, `skills/` |

Start here: [docs/api-contract.md](docs/api-contract.md) → [docs/architecture.md](docs/architecture.md)

Using an AI agent? It reads [AGENTS.md](AGENTS.md). **Muse Code users:** do the one-time setup in [docs/muse-setup.md](docs/muse-setup.md) first.

## Run the backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest -q
```

End-to-end (with the API running): `cd tests/e2e && pytest -q -rx`. Deployment: [docs/deployment.md](docs/deployment.md).

Try OCR now:
```bash
curl -F image=@../data/sample_labels/granola_correct.png http://localhost:8000/ocr
```

## Workflow
- Branches: `feature/ocr-extraction`, `feature/backend-api`, `feature/frontend-upload`, `feature/deployment`
- `main` is protected: open a PR, link the issue, include test results. The three required CI checks must pass, and the branch must be up to date with `main` (use **Update branch**). Ask a teammate to review when possible.
- After your PR merges, start your next task on a **new branch from the latest `main`**. Don't keep committing to the merged one.
- *MVP completeness* is a non-required check. It stays red until every route works, which is expected during the build.
- Log AI agent usage in [docs/ai-usage.md](docs/ai-usage.md)

## Milestones
| Date | Milestone |
|---|---|
| Oct 14 | Repo, roles, architecture, API contract |
| Oct 15 | Frontend/backend skeleton, OCR prototype |
| Oct 16 | Upload → OCR → comparison working locally |
| Oct 17 | Full integration |
| Oct 18 | Public deployment, E2E tests |
| Oct 19 | Bug fixes, docs, rehearsal |
| Oct 20 | Presentation |
