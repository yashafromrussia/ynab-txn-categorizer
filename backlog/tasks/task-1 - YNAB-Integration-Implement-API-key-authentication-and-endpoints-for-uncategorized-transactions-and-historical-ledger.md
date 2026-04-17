---
id: TASK-1
title: >-
  YNAB Integration: Implement API key authentication and endpoints for
  uncategorized transactions and historical ledger
status: Done
assignee: []
created_date: '2026-04-17 13:15'
updated_date: '2026-04-17 21:40'
labels: []
dependencies: []
---

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor `YnabClient` to use a shared `axios` instance configured with the Base URL and Bearer token, and add error handling for authentication failures (401).
2. Add `getUncategorizedTransactions()` method using the YNAB API `GET /budgets/{budget_id}/transactions?type=uncategorized`.
3. Add `getTransactionsByPayee(payeeId: string)` method using the YNAB API `GET /budgets/{budget_id}/payees/{payee_id}/transactions` for the historical ledger.
4. Define and export basic TypeScript interfaces for `Transaction` objects to ensure type safety across the application.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented `YnabClient` with centralized `axios` instance configured with the Base URL and Bearer token, along with a 401 error interceptor. Added comprehensive TypeScript interfaces for YNAB `Transaction` objects. Implemented `getUncategorizedTransactions` to fetch transactions lacking categories and `getTransactionsByPayee` to retrieve historical ledger entries for specific payees, satisfying requirements for Phase 1 of the deterministic categorizer. Verified implementation via clean build.
<!-- SECTION:FINAL_SUMMARY:END -->
