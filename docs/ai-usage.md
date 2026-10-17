# AI-Assisted Development Log

**Everyone appends here** (required for the CSE 651 rubric). One line per session:
`YYYY-MM-DD | who | tool | what you asked | what you kept / changed / rejected`

| Date | Who | Tool | Task | Outcome |
|---|---|---|---|---|
| 2026-10-17 | Tray | Claude Code | Review + fix Wenyi's follow-up commits (PR #12); prevent stale branches | Kept. Her commits on the already-merged branch removed a function `api.ts` imported (broken build) and broke small TIFF uploads; fixed both. Prevention: synced her branch to `main`, required up-to-date branches before merge, added sync-before-push rules to AGENTS.md |
| 2026-10-17 | Tray | Claude Code | Review + fix Wenyi's frontend PR #10 and merge | Kept. CI failed only on the missing package-lock.json. Review also caught two production bugs CI couldn't: no photo compression (Vercel 4.5 MB limit) and the API URL defaulting to localhost. Agent added `image.ts`, a `/api` production default, and the frontend route in vercel.json; verified all pages live |
| 2026-10-16 | Tray | Claude Code | Tracker alignment, branch protection, QA templates, AGENTS.md + Muse setup | Kept. Agent found the post-deploy check never fired (Vercel sends no deployment events) and switched it to polling `/api/health` for the commit. Muse permissions are per-user, so the repo gets AGENTS.md + a setup guide instead of a shared permission file |
| 2026-10-16 | Tray | Claude Code | Vercel deploy (Services + Neon), CI + E2E workflows, testing Skill, SKU/date samples | Kept. Agent found a production-only OCR crash (desktop OpenCV) and switched to rapidocr 3.x. New models made the blurry sample too easy; agent re-tuned it until OCR misread the date at 0.87 confidence, which became the key `uncertain` test case |
| 2026-10-14 | Tray | Claude Code | Repo skeleton, OCR module, sample labels, API contract, ADR 0001 | Kept; chose RapidOCR after measuring it on the samples; stubs left for teammates |
| 2026-10-17 | Wenyi | Muse | SaaS redesign of frontend per team mockup (sidebar shell, new home, specs/inspect/history refresh) | Kept. Redesign only — no backend or API contract changes; all existing features preserved (drag-drop, preview, 1600px/4MB compression, OCR fallback, labeled demo mock); omitted mockup elements with no contract backing (approval badges, versions, reviewer names, invented stats) |
