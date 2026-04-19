---
id: TASK-8
title: >-
  Review UI: Build a TUI (Terminal User Interface) for approving/correcting
  suggestions
status: Done
assignee: []
created_date: '2026-04-17 13:15'
updated_date: '2026-04-19 00:29'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a bespoke, easy-to-use TUI for human-in-the-loop transaction categorization review. Style/feel inspired by OpenCode and Crush CLIs. User should be able to manually select which uncategorized transaction to evaluate, and the result appears in a popup-style UI element showing the output and the evaluation stage it landed at.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User can manually select a single transaction to evaluate from a list of uncategorized ones
- [ ] #2 Option to run all transactions in batch mode is available
- [ ] #3 Evaluation result renders in a popup/note-style UI element showing the stage (1/2/3) and output
- [ ] #4 TUI has clean, modern styling consistent with OpenCode/Crush CLIs (clack + chalk)
- [ ] #5 Exit option cleanly terminates the session
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
"1. Add @clack/prompts + chalk dependencies\n2. Create src/ui.ts with selectTransactionToEvaluate (interactive list) and displayEvaluationResult (popup note)\n3. Refactor src/index.ts main loop to use TUI - intro, select, spinner, popup result\n4. Preserve existing 3-stage evaluation pipeline (Deterministic → Identity/AI → Deep Reasoning)\n5. Build & verify diagnostics clean"
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Used @clack/prompts for interactive prompts, spinner and notes. Used chalk for styling. ui.ts exposes selectTransactionToEvaluate (returns single tx, 'ALL', or exits on 'EXIT') and displayEvaluationResult (note-style popup with stage + result + optional details). Stage 3 JSON is parsed best-effort to pull reasoning/confidence into the popup details section.
<!-- SECTION:NOTES:END -->
