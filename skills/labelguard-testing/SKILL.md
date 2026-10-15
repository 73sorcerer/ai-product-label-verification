---
name: labelguard-testing
description: Use when running, writing, or debugging tests for the product label verification app (FastAPI backend, OCR, verification engine, sample labels).
---

# Label verification testing

OWNER: Vincent. STUB: expand into the reusable CSE 651 Skill.

## Run
```bash
cd backend
pip install -r requirements.txt
python ../data/sample_labels/generate_samples.py   # only if images are missing
pytest -q
```

## Rules
- Fixtures with known answers live in `data/sample_labels/manifest.json`. Add a sample there before writing a test for a new defect type.
- Never weaken a test to make code pass. Fix the code, or explain why the test is wrong and stop.
- OCR tests assert that the text was *read*; verification tests assert that it was *judged*. Keep them separate.

## TODO(Vincent)
- [ ] End-to-end test against the deployed URL
- [ ] Instructions for packaging and installing this skill
