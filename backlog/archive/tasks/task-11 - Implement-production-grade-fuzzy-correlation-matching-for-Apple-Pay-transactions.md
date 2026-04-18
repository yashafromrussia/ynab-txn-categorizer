---
id: TASK-11
title: >-
  Implement production-grade fuzzy/correlation matching for Apple Pay
  transactions
status: To Do
assignee: []
created_date: '2026-04-18 11:39'
labels:
  - matching
  - apple-pay
  - fuzzy
  - reconciliation
milestone: MVP-Apple-Pay-Matcher
dependencies: []
references:
  - 'https://github.com/LerianStudio/matcher'
  - 'https://github.com/europeanplaice/subset_sum'
  - 'https://github.com/actualbudget/actual/pull/2300'
  - 'https://www.settler.dev/'
  - 'https://github.com/graysoncadams/amazon-ynab-sync'
  - 'https://docs.cozy.io/en/cozy-banks/docs/bills-matching/'
  - 'https://github.com/dpss/subset_sum'
  - 'https://github.com/actualbudget/actual'
documentation:
  - 'https://docs.cozy.io/en/cozy-banks/docs/bills-matching/'
  - 'https://github.com/LerianStudio/matcher'
  - 'https://github.com/europeanplaice/subset_sum'
  - 'https://github.com/dpss/subset_sum'
  - 'https://github.com/GraysonCAdams/amazon-ynab-sync'
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Use production-grade patterns for correlating Apple Pay and bank/YNAB-style transactions via fuzzy matching and date/amount tolerance. Leverage open-source implementations as evidence and inspiration. Provide Implementation Plan for backlog.

What to base on (evidence sources):
- Transaction matching with amount + date window (1:1, 1:N, N:M) – Cozy/Linker approach with configurable deltas (dateLowerDelta, dateUpperDelta, amountLowerDelta, amountUpperDelta) [Apple Pay context].
- Open-source reconciliation engines using rule-based and tolerance matching, e.g., Lerian Matcher (GitHub: https://github.com/LerianStudio/matcher) – supports contexts, sources, rules, and confidence scoring.
- Subset-sum based reconciliation engines (dpss – European Plaice) for many-to-many matching with tolerance: https://github.com/europeanplaice/subset_sum
- Settler: Open Source Reconciliation Engine with deterministic matching and audit trails – https://www.settler.dev/ (GitHub repos for code exist)
- Examples of fuzzy matching in YNAB/Actual budgets – actualbudget/actual PRs improving fuzzy matching windows: https://github.com/actualbudget/actual/pull/2300 and related PRs, plus amazon-ynab-sync style implementations: https://github.com/graysoncadams/amazon-ynab-sync
- Apple Pay documentation references for merchants and web integration (for payee/merchant context):
  - Apple Pay Merchant Integration Guide (PDF): https://[Apple-Docs]...Apple-Pay-Merchant-Integration-Guide.pdf
  - Configure Apple Pay on the Web: https://developer.apple.com/help/account/configure-app-capabilities/configure-apple-pay-on-the-web/
  - Apple Pay on the Web Troubleshooting: https://developer.apple.com/documentation/technotes/tn3103-apple-pay-on-the-web-troubleshooting-guide

Implementation plan will map onto these patterns and outline concrete tasks, risks, and testing.

Acceptance Criteria:
- A documented plan mapping to 3 matching stages (deterministic, tolerance window, fuzzy/payee-level) with example parameter sets.
- A PR-ready backlog with tasks that implement a minimal viable product: 1) data model, 2) matching engine, 3) tests, 4) integration notes with Apple Pay data, 5) documentation.
- Evidence-backed references included in the Implementation Plan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plan is documented and reviewable
- [ ] #2 3 modular tasks defined in backlog
- [ ] #3 Evidence-based patterns cited with permalinks
- [ ] #4 Viable MVP with 3 matching stages described
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented plan for production-grade fuzzy/correlation matching for Apple Pay transactions and downstream categorization; align with existing open-source patterns.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Draft plan ready for backlog review
- [ ] #2 Evidence links cited in plan
- [ ] #3 Tests specs outline included
<!-- DOD:END -->
