---
name: epic-orchestrator
description: Break a large Sacred Texts issue (epic, big story or multi-part bug) into GitHub sub-issues with Gherkin acceptance criteria, create one integration branch, and run dev-issue for each sub-issue in parallel or in sequence (Claude Code subagents, cloud sessions, or @claude on each sub-issue). Child PRs target the integration branch, and the parent ends with one PR into main. The orchestrator plans, delegates and tracks; it does not write app code itself. Use when asked to "split", "break down", "orchestrate" or "parallelise" issue #N.
argument-hint: "<parent issue number> [task list] [base branch]"
---

# Playbook: Orchestrate a parent issue

Plans and coordinates. **It writes no app code.** Every line of `index.html`
is written by a `dev-issue` run on a sub-issue.

**Read first:** `.claude/skills/CONVENTIONS.md` and `.claude/skills/dev-issue/SKILL.md`.

---

## Critical (MUST)

- **There must be a parent issue.** If there's only a description, propose a parent issue (in the `user_story.md` shape) and create it only after the requester confirms.
- **Get the breakdown approved.** Propose the sub-issues and wait for approval before creating anything, unless the requester supplied the task list themselves.
- Every sub-issue has **Gherkin acceptance criteria** (at least 2 scenarios: happy path plus an edge or failure case) and is linked to the parent as a **GitHub sub-issue**.
- **One integration branch** `claude/{P}-{slug}`, cut from `main` (or the stated base). Every child branches from it and opens its PR **into it**, not into `main`.
- **Child PRs don't bump the version.** Only the final integration PR into `main` bumps `CACHE`, `APP_VERSION` and the meta tag once (CONVENTIONS §6).
- Plan around **the single-file app**: children that edit the same region of `index.html` run **in sequence**, never in parallel (see §2.3).
- Every comment ends with the CONVENTIONS §4 footer. Keep the parent issue's progress table up to date.
- **Never merge.** Not child PRs, not the final PR. Humans merge.

---

## Inputs

| Input | Required | Default |
|---|---|---|
| Parent issue `P` | yes (or approval to create one) | — |
| Task list | no | Claude proposes one |
| Base branch | no | `main` |
| Execution mode | no | §5. Subagents in an interactive session, `@claude` comments in automation. |

---

## 1. Read the parent

1. Read the parent issue: title, body, labels, Gherkin, "Out of scope", and all comments.
2. List its existing sub-issues and linked PRs. If this is a re-run, carry on from the current state rather than recreating anything.
3. Work out **the kind of child**:

| Parent | Children |
|---|---|
| Epic or large story (`user-story`) | Smaller user stories (`user-story`), each meeting INVEST |
| Bug with several causes | Bugs (`bug`), one per cause or area |
| Mixed | Stories and bugs, each labelled for its own kind |

## 2. Plan the breakdown

### 2.1 If the requester gave tasks

Check each one is clear enough to build and test. Ask about any that are vague
before creating anything.

### 2.2 If not: propose

Post the proposal in the conversation, plus a comment on the parent if
triggered from GitHub:

~~~markdown
@{requester} — proposed breakdown for #{P}:

| # | Sub-issue | Kind | Touches | Depends on | Run |
|---|---|---|---|---|---|
| 1 | {title} | story | `SOHBET_CHAPTERS` | — | parallel |
| 2 | {title} | story | `renderResults`, CSS | — | parallel |
| 3 | {title} | bug | `sw.js` | 2 | after 2 |

<details><summary>Draft acceptance criteria</summary>

**1 — {title}**
```gherkin
Scenario: …
  Given …
  When …
  Then …
```
</details>

Reply **approve**, or tell me what to change. Nothing is created until then.
{footer}
~~~

### 2.3 Split rules for this app

- **One area per child:** one section array, one feature or function group, or `sw.js`. This keeps PRs small and conflicts rare.
- Content for **different arrays** can run in parallel. The blank-line margins around each array (CONTRIBUTING.md) keep their diffs apart.
- Children touching **shared code**, such as routing (`renderResults`, `state.tab`, `OPENERS`, `TAB_CHILDREN`), the top-of-file CSS, or `sw.js`, run **in sequence**, each branching from the integration branch *after* the previous child merges into it.
- Keep version bumps out of the children entirely.
- About 5 scenarios or fewer per child. Split anything larger.

## 3. Create the integration branch

```bash
git fetch origin {base}
git checkout -b claude/{P}-{slug} origin/{base}
git push -u origin claude/{P}-{slug}
```

Add `claude:in-progress` to the parent and post:

```markdown
**Orchestration started**
**Integration branch:** `claude/{P}-{slug}` from `{base}`
Child PRs target this branch; one final PR will take it into `{base}`.
{footer}
```

## 4. Create the sub-issues

For each approved child:

1. **Create the issue** using the matching template's structure:
   - **Stories:** Persona, Story, Context (with a link back to `#{P}`), Out of scope, Acceptance criteria (Gherkin), Non-functional requirements, Definition of done.
   - **Bugs:** Summary, Problem details, Environment, Steps to reproduce, Actual, Expected, Fixed when (Gherkin).
   - Title format: `[Area] | [Short action]`.
   - Add a line to the body: `**Integration branch:** \`claude/{P}-{slug}\` — branch from it, PR into it, no version bump.`
   - Labels: the kind (`bug` / `user-story`).
2. **Link it as a sub-issue** of `#{P}`: MCP `sub_issue_write` (add), or `gh api -X POST repos/{o}/{r}/issues/{P}/sub_issues -f sub_issue_id={childIssueId}`. The API takes the child's **id**, not its number.
3. Re-read the parent's sub-issue list to confirm every child is linked.

Post the plan table on the parent. This is the comment you keep editing in
place from now on:

```markdown
## Sub-issues

**Integration branch:** `claude/{P}-{slug}`

| # | Issue | Kind | Run | Status | PR |
|---|---|---|---|---|---|
| 1 | #{c1} {title} | story | parallel | ⏳ queued | — |
| 2 | #{c2} {title} | story | parallel | ⏳ queued | — |
| 3 | #{c3} {title} | bug | after #{c2} | ⏸ waiting | — |
{footer}
```

## 5. Run the children

Each child is a `dev-issue` run with **base = the integration branch**. Pick
the mode that fits where you're running:

| Mode | When | How |
|---|---|---|
| **A. Subagents** | Interactive Claude Code session (the default) | One `Agent` call per parallel child, with `isolation: "worktree"`, run in the background. Give each the child prompt below. Wait for each completion notification. Don't poll. |
| **B. Cloud sessions** | Many children, or long-running work, where cloud session tools are available | One new session per child (`create_session` with the repo and the child prompt). Track them with `get_session` / `list_events`. |
| **C. `@claude` on the sub-issue** | Automation via the GitHub Action | Comment on each child: `@claude implement this with dev-issue. Base branch: claude/{P}-{slug}.` The action runs `issue-assistant`, which routes to `dev-issue`. Track progress through PR events. |

**Child prompt** (the same in every mode):

```
Run the dev-issue playbook (.claude/skills/dev-issue/SKILL.md) for issue #{c} in zboon/SacredTexts.
Base branch: claude/{P}-{slug}. Branch from it as claude/{c}-{slug} and open the PR INTO claude/{P}-{slug}.
Do NOT bump the version (CACHE / APP_VERSION / meta). The integration PR does that once.
Only touch: {area from the plan}. If you need to change anything else, stop and report back instead.
Parent context (#{P}): {2–5 lines of relevant decisions from the parent thread}
Report back: PR URL, acceptance-criteria results, anything blocked.
```

Start the parallel children together. Start each sequential child only after
its dependency's PR has **merged into the integration branch**, so that it
branches from code that includes it.

## 6. Track progress

- When a child finishes, update its row in the parent table (✅ PR open, 🔴 blocked, ❓ needs input) and link the PR.
- **Child blocked or failed:** read its report, comment on the child issue with what went wrong, and tell the requester in one line with an offer: retry, adjust the scope, or take it on by hand. Add `claude:blocked` to the child.
- **A child needs a decision:** pass the question to the requester right away. Don't guess on their behalf.
- Child PRs get a `pr-review` run like any other PR. A human merges them into the integration branch.
- Report to the requester when something changes, not on a timer.

## 7. Integrate and finish

When every child PR has merged into the integration branch:

1. `git checkout claude/{P}-{slug} && git pull`. Merge `{base}` in if it moved (merge, don't rebase).
2. Run the static check (CONVENTIONS §7.1) and a browser smoke test. Walk the **parent's** Gherkin scenarios end to end.
3. Bump the version once as the final commit: `#{P}: Bump to vNNN`.
4. Open the integration PR into `{base}`, titled `#{P}: {summary}`, with this body:

```markdown
Closes #{P}

## Included
| Sub-issue | PR | Summary |
|---|---|---|
| #{c1} | #{pr1} | … |

## Parent acceptance criteria
| Scenario | Result |
|---|---|

## Release note
**{plain-language title}**
{2–3 sentences for reciters and learners}

## Checklist
- [ ] All sub-issues closed by their merged PRs
- [ ] Static check passes; version bumped once (vA → vB)
- [ ] Parent scenarios pass (offline / 360px / dark mode where relevant)
- [ ] Human QC
{footer}
```

Child PRs say `Closes #{c}`, but they merge into the integration branch, not
the default branch, so GitHub won't auto-close the child issues. Close each
child issue by hand once its PR has merged into the integration branch, with
a one-line comment pointing to the PR.

5. Update the parent table to its final state. Swap the parent's `claude:in-progress` for `claude:completed`, and post a short final summary on the parent: the PR link, then the next steps (`pr-review`, `/test-issue {P}`, human merge).
6. Give the requester the same summary in chat, with links to every sub-issue and PR and any open problems.

---

## Error handling

| Situation | Do |
|---|---|
| Breakdown not approved | Wait. Don't create issues or branches. |
| Sub-issue creation or linking fails | Retry 3×. Never leave a child unlinked. Report the gap in the parent table. |
| Two children conflict in `index.html` | Make them sequential. Merge the integration branch into the later child's branch to resolve, and tell the requester. |
| A child turns out much bigger than planned | Stop that child, propose a further split on the parent, wait for approval |
| `main` moves during the work | Merge `main` into the integration branch before the final PR (step 7.1) |
| The requester asks to stop | Stop starting new children. Report what's in flight. Leave the open PRs for a human. |
