---
name: issue-assistant
description: Entry point for "@claude" mentions on Sacred Texts issues and PRs. Reads the issue and thread, classifies the request (develop, test, regression, review, investigate, content help, explain, multi-step), then either routes to the matching playbook (dev-issue, test-issue, regression-pack, pr-review) or answers directly in a concise comment. Use whenever someone tags @claude on an issue or PR, or asks Claude to "look at" / "help with" issue #N without a more specific playbook.
argument-hint: "<issue or PR number> [the request text]"
---

# Playbook: Issue assistant (@claude mentions)

The front door. Work out what's being asked, then hand off to a specialist
playbook or answer it yourself.

**Read first:** `.claude/skills/CONVENTIONS.md`.

---

## Critical (MUST)

- Be concise. The thread is for people reading on a phone.
- Read the **whole** issue and thread before acting, not just the mention.
- Route to the specialist playbook rather than reinventing it. Run it in this same session (invoke the skill) unless the harness gives you a way to start a separate session, such as an automation dispatcher.
- Every comment ends with the CONVENTIONS §4 footer.
- Content you write or suggest must follow the README copyright policy: public-domain originals, our own English.

---

## Trigger

- An issue or PR comment containing `@claude` (via `claude-code-action` or a cloud session handed the comment), or
- A user in a session says "help with issue #N" with no more specific verb.

## Inputs

Issue/PR number, the triggering comment (text, author, id), and the repo.

---

## 1. Gather

1. The issue or PR: title, body, labels, state, author, assignees.
2. All comments in order. Find the **latest** `@claude` comment. That's the request. Note its author (the requester).
3. Earlier Claude activity (the `claude-playbook` markers), so you continue rather than repeat.
4. Linked issues and PRs if they matter.

## 2. Classify and route

| Intent | Signals | Route |
|---|---|---|
| **Develop** | "fix", "implement", "build", "work on", "add", "do this" | → `dev-issue {N}` |
| **Test** | "test", "QA", "check it works", "verify" | → `test-issue {N}` |
| **Regression** | "automate", "add to regression", "confirm this bug with a test" | → `regression-pack {N}` |
| **Review** | on a PR: "review", "look over this PR" | → `pr-review {PR}` |
| **Investigate** | "why", "investigate", "what's causing", "look into" | § 3 |
| **Content help** | "transliterate", "translate", "draft the entry", "format this qasida", "is this public domain?" | § 4 |
| **Explain** | "how does", "where is", "what is" | § 5 |
| **Multi-step** | several verbs joined with "and"/"then" | § 6 |
| **Unclear** | none of the above | ask (§ 7) |

When routing, post a one-line acknowledgement first, then run the playbook:

```markdown
@{requester} — on it: running `{playbook}` for #{N}. I'll update this thread when done.
{footer}
```

## 3. Investigate

1. Reproduce if possible. Serve the app locally (CONVENTIONS §7.2) and use Chromium at phone size. Bugs often depend on cache version, offline state or installed-PWA mode, so check the reporter's environment block.
2. Grep `index.html` for the code path. The usual suspects:
   - `renderResults` and the `open*` functions (navigation)
   - `sw.js` (stale content, offline)
   - the `mawlid-*` `localStorage` keys (lost settings)
   - `@font-face` / `unicode-range` (blobs, missing harakat)
   - `SESSION_CONFIG` and the session code (Live)
3. Reply:

```markdown
@{requester} — investigation complete.

**Summary:** {one or two sentences}
**Root cause:** {what and where — `index.html` function / array, `sw.js` line}
**Reproduces:** {yes/no — on vNNN, Chromium 390×844, online/offline}
**Recommendation:** {fix outline · or "ready for `@claude fix this`"}
{footer}
```

If the issue isn't in the bug template's shape (missing Gherkin or environment),
offer a corrected body for it. Don't edit someone else's issue body without asking.

## 4. Content help

Use this for drafting entries for a section array.

1. Produce the entry in the exact README/CONTRIBUTING shape:

```js
{
  titleArabic : "…",
  titleEnglish: "N · …",
  note        : "…",              // optional
  verses: [
    { ar: "… ۞ …", tr: "…", en: "…" }
  ]
}
```

2. Mark it clearly:
   - **Source text:** cite the public-domain source (author, death date or edition). If you can't establish it's public domain, say so and propose linking instead of copying.
   - **Transliteration and English:** say they are a draft for human checking. Never present a devotional translation as authoritative.
   - **Arabic:** never "correct" vocalisation (harakat) without flagging each change for a knowledgeable reviewer.
3. Post it in a fenced `js` block with a short "Where it goes" line (the array, the position by `N ·` number, and the branch: the section branch if the requester works there, else `main`).
4. Offer `@claude add this` as the next step, which routes to `dev-issue`.

## 5. Explain

Answer from the code and README, with `index.html` function or array names
the requester can search for. Keep it to a short answer, a "how it works" note
if needed, and where to look. No essays.

## 6. Multi-step

Post the plan first, then go through the steps in order:

```markdown
@{requester} — I'll do this in order:
1. {step} → `{playbook or §}`
2. {step}
Reply to adjust; otherwise I'm proceeding.
{footer}
```

Run each step. Post one final summary (✓/✗ per step, links to PRs and
comments), not a comment per micro-step.

## 7. Ask, decline, or block

| Situation | Reply with |
|---|---|
| Ambiguous | What you understood + 1–3 specific questions |
| Out of scope (e.g. deploy settings, GitHub Pages config, Supabase dashboard) | Why, plus what the requester should do and what you *can* do |
| Copyright concern | That the text can't be copied, why, and the link-instead alternative |
| Permission or tool failure | The error, which permission is missing, and the next step. Add `claude:blocked`. |
| Technical blocker mid-task | What you tried, the current state, the recommended next move. Add `claude:blocked`. |

---

## Examples

**"@claude can you fix this?"** on a bug: acknowledge, then run `dev-issue`.

**"@claude why is the Burdah blank on my phone?"**: §3. Check the reporter's
cache version against `main`. A stale build plus a missing bump is the usual
cause. Reply with the root cause and the fix outline.

**"@claude draft the entry for Yunus Emre's 'Dertli dolap' with English"**:
§4. Confirm Yunus Emre (d. 1320) is public domain. Draft the `ILAHI_CHAPTERS`
entry with `latin: true`, Turkish in `ar`, `tr: ""`, and our own English
flagged as a draft.

**"@claude investigate and then fix"**: §6. Plan comment, then §3, then
`dev-issue`, then a final summary.
