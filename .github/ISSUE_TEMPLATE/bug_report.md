---
name: Bug report
about: Something is broken, displays wrongly, or has incorrect content
title: "[Area] | [What is wrong]"
labels: bug
assignees: ""
---

<!--
RULE: A bug is not "confirmed" until its reproduction scenario exists as a failing automated test.

SEVERITY
- Critical: private content exposed, app won't load, or content/data lost
- High: a core flow is broken, no workaround
- Medium: broken, but a workaround exists
- Low: cosmetic
-->

## Summary
**Type:** Functional / Display / Offline / Content
**Severity:** Critical / High / Medium / Low
**Frequency:** Always / Sometimes / Once
**Regression (worked before?):** Yes / No / Unknown

## Problem details
<!-- 1-2 sentences: what is wrong and where -->

## Environment
- Device / OS:
- Browser or installed PWA:
- Online / offline:
- Cache version (`nhacademy-vNNN`):

## Steps to reproduce

```gherkin
Given [starting state]
When [action]
Then [what should happen]
```

## Actual result

## Expected result

## Evidence
<!-- Screenshots, screen recording, console errors. Drag and drop files here. -->

## Impact
<!-- Who is affected, what they can't do, any workaround -->

## Fixed when

```gherkin
Given [starting state]
When [action]
Then [expected behaviour]
And nothing else has changed (regression check)
```
