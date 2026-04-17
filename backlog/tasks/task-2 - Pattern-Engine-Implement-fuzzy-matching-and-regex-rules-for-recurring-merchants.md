---
id: TASK-2
title: >-
  Pattern Engine: Implement fuzzy matching and regex rules for recurring
  merchants
status: Done
assignee:
  - Sisyphus
created_date: '2026-04-17 13:15'
updated_date: '2026-04-17 21:50'
labels: []
dependencies: []
---

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create `src/pattern-engine.ts` with a `PatternEngine` class.
2. Define a `PatternRule` interface containing rule type (`exact`, `regex`, `fuzzy`), the match pattern, and the output `categoryId`.
3. Implement `addRule` and `evaluate(payeeName: string)` methods.
4. Integrate `fast-levenshtein` to handle fuzzy matching for recurring merchants where names change slightly (e.g., POS terminal IDs).
5. Write unit tests in `tests/pattern-engine.test.ts` to verify the logic.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Installed fast-levenshtein for efficient string distance calculation

Added PatternRule interface with support for exact, regex, and fuzzy matching

Wrote unit tests verifying each match type and edge cases
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented `PatternEngine` with support for exact, regex, and fuzzy matching (via fast-levenshtein and substring inclusion). Tests written and passing using Vitest.
<!-- SECTION:FINAL_SUMMARY:END -->
