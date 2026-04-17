---
id: TASK-10
title: 'Interactive CLI Fallback: Add human oversight for unmatched transactions'
status: To Do
assignee: []
created_date: '2026-04-17 22:38'
updated_date: '2026-04-17 22:39'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a terminal-based interactive prompt to allow the user to manually categorize transactions when the automated pattern engine fails to find a match.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fetch available categories from YNAB API
- [ ] #2 Pause execution when pattern engine returns null
- [ ] #3 Present an interactive CLI prompt to select a category
- [ ] #4 Display transaction context (date, payee, amount, calendar events) during prompt
<!-- AC:END -->
