# Claude Code playbooks for Sacred Texts

Standard processes Claude Code follows on this repo. Each folder is a
**Claude Code skill**, so it can be invoked by name in a session
(`/dev-issue 42`), called by another playbook, or triggered from automation.

Shared rules (labels, comment footer, branches, version bump, validation)
live in [`CONVENTIONS.md`](CONVENTIONS.md). Read that first.

| Playbook | Invoke | Does | Hands off to |
|---|---|---|---|
| [`issue-assistant`](issue-assistant/SKILL.md) | `@claude …` on an issue or PR, or `/issue-assistant N` | Classifies the request; investigates, drafts content or explains; routes the rest | any of the below |
| [`dev-issue`](dev-issue/SKILL.md) | `/dev-issue N` | Branch → implement → validate → version bump → PR `Closes #N` → release notes | `pr-review`, `test-issue` |
| [`pr-review`](pr-review/SKILL.md) | `/pr-review PR` | Breaking-issue-only review with inline comments and a verdict. Never approves. | human QC |
| [`test-issue`](test-issue/SKILL.md) | `/test-issue N` | Local exploratory and acceptance testing with screenshots. Results comment plus a happy-path Playwright script. | `regression-pack` |
| [`regression-pack`](regression-pack/SKILL.md) | `/regression-pack N` | Turns tested scenarios into `tests/e2e` Playwright tests mapped in `tests/REGRESSION.md`. Also confirms bugs with failing tests. | CI (future) |

## Lifecycle

```
issue (bug_report / user_story with Gherkin)
  └─ @claude ─► issue-assistant ─► dev-issue ─► PR (Closes #N, vNNN bump)
                                       │             └─► pr-review ─► human QC + merge
                                       └─► test-issue ─► results + script ─► regression-pack ─► tests/e2e
bugs: regression-pack (bug mode) can run BEFORE dev-issue to confirm the bug with a failing test
```

## Automation

The playbooks are written so a non-interactive run can follow them:

- **GitHub Actions:** `anthropics/claude-code-action` on `issue_comment` / `pull_request_review_comment` containing `@claude` → `issue-assistant`. On `pull_request: [opened, synchronize]` → `/pr-review ${{ github.event.pull_request.number }}`.
- **Headless CLI:** `claude -p "/dev-issue 42"`.
- **Scheduled / agent fan-out:** one session per issue, each told which playbook to run.

No workflow files are included yet. Add them as a separate change.
