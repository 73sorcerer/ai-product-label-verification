# Reusable AI Skills

**Owner:** Vincent

Agent skills packaged for the CSE 651 requirement. Each folder holds a `SKILL.md` (name and description in the frontmatter, instructions in the body) plus any helper scripts.

| Skill | Use it for |
|---|---|
| [labelguard-testing](labelguard-testing/SKILL.md) | Running and debugging unit, OCR and E2E tests; telling OCR misreads from verification bugs; adding sample labels |

## Install

**Claude Code** (this project only, from the repo root):
```bash
mkdir -p .claude/skills && cp -r skills/labelguard-testing .claude/skills/
```
For all your projects, copy it to `~/.claude/skills/` instead. Restart the session. The agent loads the skill automatically when a task matches its description.

**GitHub Copilot / other agents:** copy the folder to `.github/skills/` (Copilot) or point the agent at `skills/labelguard-testing/SKILL.md`.

## Try it
Ask your agent: *"The vitamin label came back incorrect for best_by. Is that OCR or verification?"* It should run `ocr_report.py`, see the 0.87-confidence misread, and say the field should be `uncertain`.
