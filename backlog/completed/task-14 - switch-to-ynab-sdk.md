---
id: TASK-14
title: switch to ynab sdk
status: Done
assignee:
  - sisyphus
created_date: '2026-04-19 02:43'
updated_date: '2026-04-19 10:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
use ynab sdk instead of the api https://www.npmjs.com/package/ynab
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `src/ynab.ts` uses the official `ynab` npm SDK (no `axios` imports)
- [x] #2 `YnabClient` public API is unchanged: same constructor `(token, budgetId)`, same methods (`getTransactions`, `getUnapprovedTransactions`, `getTransactionsByPayee`, `getTransactionsByDateAndAmount`, `getCategories`), same return types
- [x] #3 Exported `Transaction`, `SubTransaction`, `Category` interfaces remain structurally identical so `src/index.ts`, `src/correlation.ts`, `src/confidence-scoring.ts`, and tests compile without changes
- [x] #4 SDK responses are normalized: `undefined` -> `null` for optional string fields on the boundary; `cleared` and `flag_color` coerced to `string | null`
- [x] #5 401 auth failures still log the existing `YNAB API Authentication failed...` message
- [x] #6 `axios` removed from `package.json` dependencies
- [x] #7 `npm run build` succeeds and `npm test` passes with no test file modifications
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Plan: Switch `src/ynab.ts` to official `ynab` SDK

### Context
`src/ynab.ts` exports a `YnabClient` that wraps axios calls to `https://api.ynab.com/v1`. Callers (`src/index.ts`, `src/correlation.ts`) and tests (`tests/correlation.test.ts`) depend on:
- Class: `YnabClient(token, budgetId)` with methods `getTransactions`, `getUnapprovedTransactions`, `getTransactionsByPayee`, `getTransactionsByDateAndAmount`, `getCategories`.
- Types: `Transaction`, `SubTransaction`, `Category` (exact field shapes - tests construct mock `Transaction` literals with `null` for optional fields).

### Strategy
Swap axios for `ynab` SDK **internally** while keeping the public surface 100% stable. Keep our own `Transaction`/`SubTransaction`/`Category` interfaces as adapter types; normalize SDK responses into them. This avoids cascading type changes into `correlation.ts` (which does `candidates[0].category_name === 'Split'` - works with both `string | null` and SDK's `string | null | undefined` only if we normalize).

### Steps
1. `npm install ynab@4.1.0` and `npm uninstall axios` (sole caller was `ynab.ts`).
2. Rewrite `src/ynab.ts`:
   - Import `* as ynab from 'ynab'`.
   - Keep existing `Transaction`, `SubTransaction`, `Category` interfaces verbatim.
   - In constructor: `this.api = new ynab.API(token)`; store `budgetId`.
   - Add private `normalizeTransaction(t)` and `normalizeSubTransaction(s)` helpers that map SDK `TransactionDetail`/`HybridTransaction`/`SubTransaction` -> our local interfaces (coerce `undefined` -> `null`, enum values -> strings).
   - Implement each method by calling the SDK and mapping:
     - `getTransactions(sinceDate?)` -> `api.transactions.getTransactions(budgetId, sinceDate)` -> `.data.transactions.map(normalize)`
     - `getUnapprovedTransactions(sinceDate?)` -> same with `'unapproved'` type enum
     - `getTransactionsByPayee(payeeId)` -> `api.transactions.getTransactionsByPayee(budgetId, payeeId)` (HybridTransaction -> normalize, drop `parent_transaction_id`)
     - `getTransactionsByDateAndAmount` -> unchanged body (delegates to `this.getTransactions`)
     - `getCategories()` -> `api.categories.getCategories(budgetId)`, iterate `data.category_groups`
   - Wrap each SDK call in try/catch to preserve the existing `console.error('YNAB API Authentication failed...')` behavior on 401 (SDK throws `{ error: { id: '401', ... } }`).
3. Verify via `npx tsc --noEmit` (LSP diagnostics) + `npm test`.
4. Verify `axios` still resolves/is unused via grep.
5. Atomic commit.

### Risks / Notes
- SDK `TransactionClearedStatus` and `TransactionFlagColor` are string enums - safe to assign to `string` fields via normalization.
- `HybridTransaction` has `parent_transaction_id` (not in our `Transaction`) - ignored during normalization.
- SDK response shape is `{ data: { transactions: [], server_knowledge } }` - matches current axios shape, so `getTransactionsByDateAndAmount` logic is unaffected.
- `getCategories` response: `data.category_groups[].categories[]` with `hidden`/`deleted` on both group and category - same filter logic applies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `src/ynab.ts` using `ynab@4.1.0` SDK. All 18 existing tests pass (`npm test`) and `npm run build` succeeds. `axios` removed from deps; `gaxios` in lockfile is an unrelated transitive from `googleapis`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced axios-based YNAB HTTP client with the official `ynab` npm SDK (v4.1.0) in `src/ynab.ts`.

**What changed**
- `src/ynab.ts`: swapped axios for `new ynab.API(token)`; added `normalizeTransaction`/`normalizeSubTransaction` helpers that coerce SDK `undefined`/enum values into our stable `Transaction`/`SubTransaction` shape (`string | null` for optional strings). 401 error handling preserved by matching the SDK's `{ error: { id: '401' } }` thrown payload.
- `package.json` / `package-lock.json`: `ynab@^4.1.0` added; `axios` removed (was only used by `src/ynab.ts`).

**What did not change**
- `YnabClient` public surface: same constructor signature, same five methods, same return types.
- `Transaction`, `SubTransaction`, `Category` interfaces: kept as an adapter boundary so `src/index.ts`, `src/correlation.ts`, `src/confidence-scoring.ts`, and `tests/correlation.test.ts` compile untouched (test mocks still pass `null` for optional fields).

**Verification**
- `npx tsc --noEmit`: clean.
- `npm test`: 18/18 pass across `correlation`, `contextual-prompting`, `pattern-engine`.
- `npm run build`: clean.
<!-- SECTION:FINAL_SUMMARY:END -->
