---
name: dev-issue
description: Implement a GitHub issue in Sacred Texts end to end. Read the issue, branch, make the change in index.html/sw.js, validate, bump the version, open a PR that closes the issue, and post release and testing notes. Use when asked to "work on", "fix", "implement" or "build" issue #N, or when issue-assistant routes a development request here.
argument-hint: "<issue number> [base branch] [extra instructions]"
---

# Playbook: Develop a GitHub issue

Takes one issue from "described" to "PR open, validated, documented". The
`test-issue` playbook does the deeper exploratory testing afterwards.

**Read first:** `.claude/skills/CONVENTIONS.md` (labels, footer, branch/commit
format, version bump, validation). This playbook does not repeat those rules.

---

## Critical (MUST)

- Branch from `main` unless told otherwise (CONVENTIONS §5). Branch name `claude/{N}-{slug}`.
- Prefix **every** commit with `#{N}: `.
- Run the static check (CONVENTIONS §7.1) and a browser smoke load before every push. Never push an `index.html` that fails `node --check`.
- On a PR into `main`, bump `sw.js` `CACHE`, `APP_VERSION` and `<meta name="app-version">` together, as the last commit.
- PR body contains `Closes #{N}` and the sections in step 6.
- Edit only what the issue needs. On a section branch, only that section's array (CONTRIBUTING.md).
- Write release notes for a reciter or learner, not a developer.
- Do not proceed on an unclear issue. Ask (step 2) and stop.

---

## Inputs

| Input | Required | Default |
|---|---|---|
| Issue number `N` | yes | — |
| Base branch | no | `main` (or the harness-assigned branch) |
| Requester | no | issue author, or whoever tagged @claude |
| Extra instructions | no | — |

---

## Procedure

### 1. Gather context

1. Read the issue: title, body, labels, assignees, and **all** comments in order.
2. Pull out:
   - **Type:** `bug` / `user-story` / task (from labels or template headings).
   - **Acceptance criteria:** the Gherkin in "Acceptance criteria" (story) or "Fixed when" (bug). These are your definition of done.
   - **Out of scope** (stories) and **Environment / cache version** (bugs).
   - Decisions or constraints from the comments, plus linked issues and PRs.
3. Look for earlier Claude runs on this issue (the `claude-playbook` marker). Continue from them; do not start over.

### 2. Check the issue is ready

Proceed only if all of these hold:

- [ ] The problem or capability is clear.
- [ ] Acceptance criteria exist, or can be derived without guessing intent.
- [ ] The scope is one coherent change (the story template says split anything above about 5 scenarios).
- [ ] Any content to be added is public domain, or comes with its source (README copyright policy).

If not, post one comment and stop. Leave the labels alone and don't add `claude:in-progress`:

```markdown
@{requester} — before I start, I need:

- {specific question 1}
- {specific question 2}

Once these are answered, re-tag me and I'll pick it up.
{footer}
```

### 3. Start

1. `git fetch origin {base} && git checkout -b claude/{N}-{slug} origin/{base}` (or check out the assigned branch).
2. Add the `claude:in-progress` label.
3. Post a short start comment:

```markdown
**Development started**
**Branch:** `claude/{N}-{slug}` from `{base}`
**Plan:**
- {1–4 bullets}
{footer}
```

### 4. Implement

Find the code with Grep. `index.html` is too big to read whole. Search for the
array name, function or `aria-label` and read around it.

| Change type | Where | Watch out for |
|---|---|---|
| Content (new piece, fix a verse) | The section's array (`QASIDAS`, `BURDAH_CHAPTERS`, `DALAIL_CHAPTERS`, `SILSILA_CHAPTERS`, `SOHBET_CHAPTERS`, `ILAHI_CHAPTERS`, …) | Entry shape from README. `۞` splits hemistichs, `\n` breaks lines, the `N ·` prefix sets display order, and English prose uses `latin: true` with `tr: ""`. Keep the blank-line margins around arrays. |
| UI / behaviour | The relevant render/open function (`renderResults`, `openBurdah`, …) and CSS at the top | Must work at 360px wide, in dark mode, RTL Arabic, offline |
| Offline / caching | `sw.js` | Keep the comments' reasoning intact. `AUDIO_CACHE` must stay version-free and listed in `KEEP`. |
| Fonts | `@font-face` blocks | Never modify the Uthmani font bytes. Keep the `unicode-range` correct (README "The Arabic fonts"). |
| Live Session | `SESSION_CONFIG` and session code | Anon key only. The Supabase library must stay lazy-loaded. |

Keep to the surrounding style. The file uses explanatory block comments that
say *why*, so match that density on non-obvious changes.

### 5. Validate

1. Static check (CONVENTIONS §7.1). It must print three OKs.
2. Serve on `localhost:8765` and load in Chromium at 390×844 (CONVENTIONS §7.2–7.3). No `pageerror`.
3. Walk each Gherkin scenario from the issue by hand in the browser (a Playwright script is fine). Note pass or fail for each.
4. For a bug, reproduce it on `{base}` **before** the fix and confirm it's gone after. If `tests/REGRESSION.md` lists the issue as `confirmed-bug (expected fail)`, remove the `test.fail()` marker in this PR, set the status to `automated`, and run `npm run test:issue -- @issue-{N}` green.
5. If you touched offline behaviour, confirm the service worker still registers and the app reloads with the network blocked (`context.setOffline(true)`).

If something fails and you can't fix it, add `claude:blocked`, post what failed
and what you tried, and stop. Don't open a PR with a known failure unless the
requester asked for a draft.

### 6. Commit, bump, push, PR

1. Commit in logical steps: `#{N}: {imperative summary}`.
2. Version bump as the final commit (`#{N}: Bump to vNNN`) if targeting `main`. Re-run the static check.
3. `git push -u origin claude/{N}-{slug}`.
4. Open the PR into `{base}`. Title `#{N}: {summary}`. Body:

```markdown
Closes #{N}

## Summary
{1–3 sentences: what changed and why}

## Changes
- `index.html` — {what, where (array / function)}
- `sw.js` — {cache bump vNNN → vNNN+1, and anything else}

## Acceptance criteria
| Scenario | Result |
|---|---|
| {scenario name from the issue} | ✅ pass (manual, Chromium 390×844) |

## Testing scope (for QA / `test-issue`)
- {areas a tester should hit: sections, dark mode, offline, search, etc.}
- {edge cases worth trying}
- Regression risk: {adjacent features that could break}

## Technical notes
- {decisions + why; alternatives rejected; anything a future editor must know}

## Release note
**{5–10 word title a reciter would understand}**
{2–3 sentences, plain language, no code terms. E.g. "Chapter 3 of the Burdah now has a 'Listen to the tune' link, so you can learn the melody while reading."}

## Checklist
- [ ] Static check passes (JS syntax, versions in step, manifest)
- [ ] Cache version bumped (`sacredtexts-vNNN`), or N/A for a section branch
- [ ] Works offline / at 360px / in dark mode (where relevant)
- [ ] Content is public domain + our own English (where relevant)
- [ ] Human QC

{footer}
```

### 7. Close out on the issue

1. Swap the `claude:in-progress` label for `claude:completed`.
2. Post:

```markdown
## Development complete ✅
**PR:** #{prNumber}
**Summary:** {one or two sentences}
Next: human review, then `/test-issue {N}` for an exploratory test pass.
{footer}
```

3. Don't close the issue. The PR closes it on merge.

---

## Release note language

| ✅ Write | ❌ Not |
|---|---|
| "Bookmarks now survive app updates." | "Fixed localStorage key collision on SW activate." |
| "The Burdah's third chapter has a listen link." | "Added `video` field to `BURDAH_CHAPTERS[2]`." |
| "Search now finds names typed without accents." | "Normalised NFD diacritics in fuzzy matcher." |

---

## Error handling

| Situation | Do |
|---|---|
| Issue unclear | Step 2 comment, stop |
| Static check fails | Fix before pushing. Never push a broken `index.html`. |
| Can't reproduce a bug | Comment with what you tried and the environment. Add `claude:blocked`. |
| Merge conflict with `main` | Merge `main` in (no rebase on shared branches), re-bump the version, re-validate |
| GitHub API failure | Retry up to 3 times with backoff, then report in chat |
| Content may be copyrighted | Don't add it. Ask for the source, or link it instead of copying (README policy). |
