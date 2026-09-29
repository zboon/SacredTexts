---
name: User story
about: A new feature or change, written as a user story with Gherkin acceptance criteria
title: "[Area] | [Short action]"
labels: user-story
assignees: ""
---

<!--
RULES
- INVEST: independent, negotiable, valuable, estimable, small, testable.
  If it needs more than ~5 scenarios, split the story.
- Given = state. When = ONE action. Then = observable outcome.
- Write declaratively ("the reader opens Qaṣīda Burdah"), not imperatively ("taps the third card").
- Present tense. No implementation detail (no "button", "div", "localStorage").
- Every scenario must be pass/fail testable: it becomes an automated test.
- Cover happy path, edge case and failure.
- Use "Scenario Outline" + "Examples" when only the data changes.
- Access-control rules (members vs public) get their own scenarios.
-->

## Persona
<!-- Reciter / Learner / Member / Editor -->

## Story
As a [persona]
I want [capability]
So that [benefit]

## Context / notes
<!-- Constraints, links, designs, related issues -->

## Out of scope
<!-- What this story does NOT cover -->

## Acceptance criteria

```gherkin
Feature: [name]

  Background:
    Given [shared starting state]

  Scenario: [happy path]
    Given [starting state]
    When [one action]
    Then [observable outcome]

  Scenario: [edge case]
    Given [starting state]
    When [one action]
    Then [observable outcome]

  Scenario: [failure case]
    Given [starting state]
    When [one action]
    Then [observable outcome]
```

## Non-functional requirements
<!-- Offline behaviour, performance, access (public / members), fonts, licensing -->

## Definition of done
- [ ] All scenarios pass as automated tests
- [ ] Cache version in `sw.js` bumped (if `index.html` changed)
- [ ] Works offline where relevant
- [ ] Human QC completed
