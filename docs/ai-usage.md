# AI-Assisted Development Log

**Everyone appends here** (required for the CSE 651 rubric). One line per session:
`YYYY-MM-DD | who | tool | what you asked | what you kept / changed / rejected`

| Date | Who | Tool | Task | Outcome |
|---|---|---|---|---|
| 2026-10-16 | Tray | Claude Code | Vercel deploy (Services + Neon), CI + E2E workflows, testing Skill, SKU/date samples | Kept. Agent found a production-only OCR crash (desktop OpenCV) and switched to rapidocr 3.x. New models made the blurry sample too easy; agent re-tuned it until OCR misread the date at 0.87 confidence, which became the key `uncertain` test case |
| 2026-10-14 | Tray | Claude Code | Repo skeleton, OCR module, sample labels, API contract, ADR 0001 | Kept; chose RapidOCR after measuring it on the samples; stubs left for teammates |
