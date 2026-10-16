# Muse Code setup for this repo

**For:** every teammate using Muse Code · takes ~10 minutes, once per laptop

Muse permissions are **per person**: they live in your own Muse settings and in the "always allow" choices you make in this folder. Nothing in the repo can grant them for you, so each person does these steps once.

## 1. GitHub access (Muse uses your git login)

Muse runs `git` and `gh` as **you**, so your own account needs access first.

1. Accept the repo invite: https://github.com/Auth3nticAI/ai-product-label-verification/invitations
2. Install the GitHub CLI and sign in:
   ```bash
   gh auth login          # GitHub.com → HTTPS → "Login with a web browser"
   gh auth setup-git      # lets git push use the same login
   ```
3. Clone and check that it works:
   ```bash
   gh repo clone Auth3nticAI/ai-product-label-verification
   cd ai-product-label-verification
   gh repo view --json viewerPermission -q .viewerPermission   # should print WRITE or ADMIN
   ```

## 2. Trust the workspace

Start Muse in the repo folder: `muse`. When it asks whether to **trust this workspace**, say yes.

Muse only reads `AGENTS.md` (project rules) and the project skill in `.agents/skills/` after you trust the folder. Without that step, it ignores the team's instructions.

## 3. Approve these commands once

Keep the default mode (*Auto-review* / `on-request`). When Muse asks about one of these, choose **"Always allow in this workspace"**:

| Command prefix | Why |
|---|---|
| `pytest` | Unit and E2E tests |
| `pip install -r` | Installing backend dependencies |
| `uvicorn` | Running the API locally |
| `npm ci`, `npm run`, `npx create-next-app` | Frontend |
| `git status`, `git diff`, `git log`, `git checkout -b`, `git add` | Everyday git |
| `gh pr`, `gh issue` | Opening PRs, reading issues |

Choose **Allow once** (don't save) for `git commit`, `git push` and anything that deletes files. Muse can't save `python`, `node` or `bash` as broad rules, which is why `AGENTS.md` says to run `pytest` instead of `python -m pytest`.

## 4. Network approvals

The sandbox asks the first time Muse contacts a new host. Approve these:

| Host | For |
|---|---|
| `pypi.org`, `files.pythonhosted.org` | pip |
| `registry.npmjs.org` | npm |
| `github.com`, `api.github.com` | git push, gh |
| `ai-product-label-verification.vercel.app` | Testing the live API |

## 5. Things that trip people up

- **Committing inside the sandbox may be blocked.** Muse keeps `.git` read-only in its sandbox. If a commit fails or asks for approval, approve that single command, or run `git commit` / `git push` yourself in a normal terminal.
- **Don't use `--yolo`** on your laptop. It turns off every guardrail. It's meant for throwaway CI containers.
- **First OCR call is slow** (models load). Approve once and wait; it's not hung.
- Never paste tokens or `.env` contents into the chat.

## Optional: start in Auto-review every time

`~/.config/muse/settings.json`:
```json
{ "schema_version": 1 }
```
Auto-review is already the default, so you only need this file if you changed profiles before. See Muse's [permissions](https://dev.meta.ai/docs/muse-code/permissions) and [configuration](https://dev.meta.ai/docs/muse-code/configuration) docs for the other keys.
