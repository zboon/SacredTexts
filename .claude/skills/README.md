# Claude Code playbooks for Sacred Texts

Standard processes Claude Code follows on this repo. Each folder is a
**Claude Code skill**, so it can be invoked by name in a session
(`/dev-issue 42`), called by another playbook, or triggered from automation.

Shared rules (labels, comment footer, branches, version bump, validation)
live in [`CONVENTIONS.md`](CONVENTIONS.md). Read that first.

| Playbook | Invoke | Does | Hands off to |
|---|---|---|---|
| [`issue-assistant`](issue-assistant/SKILL.md) | `@claude …` on an issue or PR, or `/issue-assistant N` | Classifies the request; investigates, drafts content or explains; routes the rest | any of the below |
| [`issue-triage`](issue-triage/SKILL.md) | `/issue-triage N`, or `@claude triage this` | Checks the report is complete, reproduces it, finds the likely cause with a confidence level, gives a workaround. No code changes. | `dev-issue`, `regression-pack` |
| [`epic-orchestrator`](epic-orchestrator/SKILL.md) | `/epic-orchestrator N` | Splits a big issue into sub-issues (with Gherkin), creates an integration branch, runs `dev-issue` per child, then opens one PR into `main` | `dev-issue` (per child) |
| [`dev-issue`](dev-issue/SKILL.md) | `/dev-issue N` | Branch → implement → validate → version bump → PR `Closes #N` → release notes | `pr-review`, `test-issue` |
| [`pr-review`](pr-review/SKILL.md) | `/pr-review PR` | Breaking-issue-only review with inline comments and a verdict. Never approves. | human QC |
| [`test-issue`](test-issue/SKILL.md) | `/test-issue N` | Local exploratory and acceptance testing with screenshots. Results comment plus a happy-path Playwright script. | `regression-pack` |
| [`regression-pack`](regression-pack/SKILL.md) | `/regression-pack N` | Turns tested scenarios into `tests/e2e` Playwright tests mapped in `tests/REGRESSION.md`. Also confirms bugs with failing tests. | CI (future) |

## Lifecycle

```
issue (bug_report / user_story with Gherkin)
  ├─ new report ─► issue-triage ─► (human decides) ─► dev-issue
  ├─ too big ───► epic-orchestrator ─► sub-issues ─► dev-issue × n ─► integration PR ─► main
  └─ @claude ─► issue-assistant ─► dev-issue ─► PR (Closes #N, vNNN bump)
                                       │             └─► pr-review ─► human QC + merge
                                       └─► test-issue ─► results + script ─► regression-pack ─► tests/e2e
bugs: regression-pack (bug mode) can run BEFORE dev-issue to confirm the bug with a failing test
```

## Automation

The playbooks are written so a non-interactive run can follow them:

- **GitHub Actions** ([`.github/workflows/claude.yml`](../../.github/workflows/claude.yml)): runs **only when someone writes `@claude`** in an issue, issue comment, PR comment or PR review. It starts at `issue-assistant`, which routes to the right playbook ("@claude triage this", "@claude review this PR", "@claude fix this", "@claude test this"). Nothing runs automatically when an issue or PR is opened. Needs the `ANTHROPIC_API_KEY` repo secret and the Claude GitHub App.
- **Headless CLI:** `claude -p "/dev-issue 42"`.
- **Scheduled / agent fan-out:** one session per issue, each told which playbook to run.

