# AI Product Label Verification

CSE 651 (Software Development with Agentic AI) · Demo: **Oct 20, 2026**

Save an approved product label spec, upload a photo of the printed label, and get **Pass** or **Needs Review**, with the reason for each field (missing, incorrect, or uncertain).

## Team
| Who | Role | Owns |
|---|---|---|
| Tray | Tech lead / OCR | `backend/app/ocr.py`, `data/sample_labels/`, `docs/` |
| Wenyi | Frontend | `frontend/` |
| Amzad | Backend | `backend/app/{main,models,database,verification}.py` |
| Vincent | DevOps | `.github/workflows/`, deployment, `skills/` |

Start here: [docs/api-contract.md](docs/api-contract.md) → [docs/architecture.md](docs/architecture.md)

## Run the backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest -q
```

Try OCR now:
```bash
curl -F image=@../data/sample_labels/granola_correct.png http://localhost:8000/ocr
```

## Workflow
- Branches: `feature/ocr-extraction`, `feature/backend-api`, `feature/frontend-upload`, `feature/deployment`
- PRs: link the issue, include test results, get one review, and CI must be green
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
