---
name: issue-triage
description: Triage a newly reported Sacred Texts issue (bug report, user question or feature request) without changing code. Checks the report against the bug_report / user_story templates, asks once for what's missing, reproduces where possible, identifies the likely cause in index.html or sw.js with a confidence level, suggests a workaround the reporter can use today, and labels the issue. Use only when asked: "/issue-triage N", "@claude triage this", "look into this report", or when issue-assistant routes a user report here. It does not run automatically on new issues.
argument-hint: "<issue number>"
---

# Playbook: Triage a reported issue

Helps the maintainers decide what to do with a report, and gives the
reporter something useful straight away. **Analysis only. No code changes, no
branches, no PRs.** `dev-issue` does the fix once a human decides to go ahead.

**Read first:** `.claude/skills/CONVENTIONS.md`.

---

## Critical (MUST)

- **Don't change code.** Don't create branches or PRs.
- **Don't assume it's an app bug.** Many reports here come from a stale cached build, the browser clearing storage, or a third-party service (YouTube, Google Fonts, Supabase) being unreachable. Say "likely" until it's reproduced.
- Ask for missing information **once**, in one comment, then stop. Before asking, check the thread so you never re-request something already given.
- Every triage comment carries a **confidence level** and ends with the CONVENTIONS §4 footer.
- Don't close the issue, change assignees, or remove labels a human added. Only add the triage labels below.
- Write for two readers: the **reporter**, who may not be technical (give them the workaround in plain words), and the **maintainer** (give them the code location).

---

## Labels this playbook sets

| Label | When |
|---|---|
| `claude:triaged` | A triage analysis has been posted |
| `claude:needs-info` | Information was requested and triage stopped. Remove it when you triage again after the reporter replies. |
| `bug` / `user-story` / `question` | Only if the issue has no kind label yet and the kind is clear |
| `not-a-bug` | Expected behaviour or an environment cause, confirmed (High confidence only) |
| `duplicate` | Clearly the same as an open issue. Link it and don't close. |

Create any label that doesn't exist yet.

---

## Inputs

Issue number `N`. Everything else is read from the issue.

---

## 1. Gather

1. Read the issue title, body, labels, author and every comment in order.
2. Find earlier triage comments (the `claude-playbook: issue-triage` marker). If you already asked for information, check whether the reporter has answered. If they haven't, stop. Don't ask again.
3. Search open and recently closed issues for the same symptom, to catch duplicates.
4. Note the current live version: `APP_VERSION` on `main` (e.g. `v385`).

## 2. Classify

| Kind | Signs |
|---|---|
| **Fault** | Something is broken, missing, displays wrongly, or content is wrong. Usually filed with the bug template. |
| **Question** | "How do I…", "Does it…", "Why does it…". The app may well be working as designed. |
| **Request** | A new section, text, feature or change. Usually filed with the story template. |
| **Content correction** | A typo, wrong harakat, mistranslation or wrong order in a text. Treat it as a Fault, but the "code location" is an entry in a section array. |

## 3. Check the information is there

### Fault: required (from `bug_report.md`)

- [ ] **What's wrong and where:** which section or piece (e.g. "Burdah chapter 3", "Dalāʾil day 2")
- [ ] **Steps to reproduce** (Gherkin or plain steps)
- [ ] **Actual vs expected** result
- [ ] **Device / OS** and **browser vs installed app** (home-screen PWA)

Strongly recommended:

- [ ] **App version.** Users can see it at the foot of the *Turkish Ilahis* page, shown as `v3.85` (= `v385`). This is the most useful single fact, because it settles "stale build" straight away.
- [ ] **Online or offline** when it happened
- [ ] **Screenshot**, especially for any Arabic rendering problem
- [ ] **Frequency** and whether it **worked before**

### Question / request: required

- [ ] A clear question, or the outcome they want
- [ ] Which section or feature it's about

### If something required is missing

Post one comment, add `claude:needs-info`, and **stop**:

```markdown
@{reporter} — thanks for reporting this. To look into it I need a little more:

- **{missing item}:** {why it helps, in plain words}
- **App version:** open *Turkish Ilahis* and scroll to the bottom — there's a small number like `v3.85`. What does yours say?

Once you've added this, I'll take another look.
{footer}
```

Keep it short and friendly. The reporter may be reading on a phone and may not be technical.

## 4. Analyse

**Never edit app files in this step.**

### 4.1 Rule out the common non-bug causes first

| Symptom | Common cause | How to check |
|---|---|---|
| "My change / new text isn't showing" | Stale service-worker cache, or the deploy is missing the version bump | Reporter's version vs `main`'s. Was `sw.js` `CACHE` bumped in the commit that added the content? |
| Bookmarks, favourites or Dalāʾil place lost | iOS Safari clears site storage for **non-installed** sites left unused for about 7 days; private browsing; the user cleared site data | Browser vs installed app. How long since they last opened it. A storage-key rename in recent commits (`git log -p -S 'mawlid-'`). |
| Downloaded audio disappeared after an update | `sw.js` cache cleanup deletes any cache not in `KEEP` | Compare `AUDIO_CACHE` in `sw.js` with the cache name used in `index.html` |
| Arabic shows as boxes or black blobs | A codepoint outside the Uthmani `unicode-range`, or a font change | Which characters. The README section "The Arabic fonts". |
| "Listen" link or audio won't play | YouTube blocked on that network or device, or the video was removed | Open the URL from the entry |
| Live Session won't connect | `SESSION_CONFIG` is empty (sessions are off by default), or no internet at the venue | `SESSION_CONFIG` on `main` |
| App blank or frozen on launch | A JS error in that build, or a very old service worker | Run the static check (CONVENTIONS §7.1) at the reporter's version: `git log --all --oneline -S "APP_VERSION = '{v}'"` |

### 4.2 Reproduce

1. Check out `main` (and the reporter's version too, if it's older and the difference matters).
2. Serve it and open it in Chromium at phone size, matching the reporter's conditions where you can: offline, dark mode, Arabic size (CONVENTIONS §7.2–7.3).
3. Follow their steps. Take a screenshot of what you see.
4. You can't reproduce iOS Safari or installed-PWA specifics here. Say so; don't guess.

### 4.3 Locate (faults and content corrections)

Grep `index.html`, don't read it whole:

- **Content:** the section array (`BURDAH_CHAPTERS`, `DALAIL_CHAPTERS`, `ILAHI_CHAPTERS`, …) and the entry by its `N ·` title.
- **Navigation:** `renderResults` and the `open*` functions.
- **Settings and storage:** the `mawlid-*` keys.
- **Offline:** `sw.js`.
- **Recent changes:** `git log --oneline -20 -- index.html sw.js` and `git log -S '{distinctive string}'`, to find whether this is a regression and which commit introduced it.

### 4.4 Confidence

| Level | Meaning |
|---|---|
| **High** | Reproduced, and the code location is identified, or a non-bug cause is confirmed from the evidence |
| **Medium** | Clear pattern and a likely location, but not reproduced (e.g. iOS-only) |
| **Low** | Several plausible causes; needs the reporter's environment |
| **Uncertain** | Not enough to go on. Prefer asking (§3) over posting an Uncertain analysis. |

### 4.5 Workaround

Only suggest a workaround you're confident works, and label it temporary. These tend to be the useful ones here:

- **Stale build:** fully close the app and reopen it, while online. Check the version on the Ilahis page.
- **Lost data on iOS:** install to the home screen (Share → Add to Home Screen) so Safari keeps the storage.
- **Audio:** open the YouTube link directly.
- **Text error:** the correct reading, quoted, until the fix ships.

## 5. Post the analysis

### Fault / content correction

```markdown
@{reporter} — thanks, I've looked into this.

**[Confidence: {High|Medium|Low}]** · **Kind:** {Fault | Content correction | Not a bug — {cause}}
**Reproduced:** {Yes, on {vNNN}, Chromium 390×844, {online/offline} | No — {why, e.g. iOS-only}}

**What's happening:** {plain-language explanation the reporter can follow}

**Workaround (until fixed):** {plain steps, or "none known"}

<details><summary>For maintainers</summary>

**Likely cause:** {hypothesis and the evidence for it}
**Where:** `index.html` → `{function / ARRAY[index] "N · title"}` (~line {n}) · `sw.js` line {n}
**Regression?** {introduced in {sha} "{commit subject}" | not a regression | unknown}
**Suggested fix:** {approach in 1–3 bullets — not a patch}
**Related:** {duplicate or linked issues}
**Next step:** `@claude fix this` (runs `dev-issue`) · or `/regression-pack {N}` first to confirm with a failing test

</details>
{footer}
```

### Question / request

```markdown
@{reporter} — {short direct answer}.

**[Confidence: {level}]**
**Details:** {how it works today, in plain words}
{**Request assessment:** fits the app? (offline-first, public-domain content policy, single-file app) · rough size · open questions}
**Next step:** {e.g. "If you'd like this, I can turn it into a user story with acceptance criteria — reply `@claude write the story`."}
{footer}
```

Then add `claude:triaged` (remove `claude:needs-info` if set), plus a kind label if one is missing.

## 6. Quality check before posting

- [ ] A confidence level is given, and it's honest
- [ ] The reporter can act on the workaround without technical knowledge
- [ ] The maintainer section names a real location you found, not a guess presented as fact
- [ ] Nothing in it asks again for information that's already in the thread
- [ ] No code was changed

---

## Edge cases

| Case | Do |
|---|---|
| Duplicate | Link the original, add `duplicate`, keep the issue open for a human to close |
| Copyright question ("can you add {modern song}?") | Explain the README content policy kindly. Suggest a link to the source instead. |
| Security or privacy report (e.g. a leaked key) | Don't repeat the secret in the comment. Point the maintainer to it briefly and recommend rotating it. |
| Report about the hosting or domain | Out of scope for code. Say what the maintainer would check (GitHub Pages settings). |
| GitHub API failure | Retry 3× with backoff. If posting still fails, give the full analysis in chat so it can be posted by hand. |

---

## Example

(Footer omitted for brevity.)

**Report:** "Since yesterday my favourites are gone. iPhone, Safari."

> @reporter — thanks, I've looked into this.
>
> **[Confidence: Medium]** · **Kind:** Not a bug (likely) — browser storage cleared
> **Reproduced:** No — iOS Safari-specific
>
> **What's happening:** When the app is used in Safari without being added to the home screen, iPhone can clear its saved data if it hasn't been opened for about a week. Favourites are stored on your phone, so they go with it.
>
> **Workaround:** Add the app to your home screen (Share → Add to Home Screen) and open it from there. Favourites saved after that are kept.
>
> *For maintainers:* no `mawlid-favs` key change found in recent commits (`git log -S 'mawlid-favs'`). If this recurs for **installed** users, re-triage as a fault.
