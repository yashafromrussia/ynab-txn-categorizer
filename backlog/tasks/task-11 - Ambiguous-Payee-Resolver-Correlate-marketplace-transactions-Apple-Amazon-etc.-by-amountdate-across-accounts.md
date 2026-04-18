---
id: TASK-11
title: >-
  Ambiguous Payee Resolver: Correlate marketplace transactions (Apple, Amazon,
  etc.) by amount+date across accounts
status: To Do
assignee: []
created_date: '2026-04-18 11:41'
labels:
  - categorization
  - correlation
  - ambiguous-payee
  - marketplace
dependencies: []
references:
  - src/index.ts
  - src/ynab.ts
  - src/pattern-engine.ts
  - src/contextual-prompting.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

Some payees are "ambiguous marketplaces" — a single merchant name can map to many different categories depending on what was actually purchased. Examples:
- **Apple** → could be App Store (Entertainment), iCloud (Subscriptions), Apple Music (Entertainment), hardware (Electronics), AppleCare (Insurance)
- **Amazon** → Groceries, Electronics, Household, Books, etc.
- **PayPal / Stripe** → pass-through for any merchant
- **Google** → Google One, YouTube Premium, Play Store, Ads

Current pipeline (`src/index.ts` → `PatternEngine` → `IdentityResolver` → LLM stages) treats these as a single payee with a single category, which produces wrong/inconsistent categorizations.

## Proposed Flow

When a transaction's payee is flagged as **ambiguous** (configurable list), instead of falling through directly to the LLM, run a **cross-account correlation** pass:

1. **Search history**: Fetch prior transactions for the same payee (`YnabClient.getTransactionsByPayee`) AND prior transactions of similar amount across *all* accounts in a date window (±N days).
2. **Correlate on (amount, date)**: Find a sibling transaction where:
   - `amount` matches within tolerance (exact cents preferred; small delta allowed for FX/fees)
   - `date` falls within a configurable window (default ±3 days)
   - The sibling is on a *different account* OR has a concrete (non-ambiguous) category already assigned
3. **Assign category**: If exactly one strong match is found, inherit that transaction's category. If multiple candidates match, bubble up to the next stage (LLM) with the candidates as hints.

### Worked example (Apple)

- New uncategorized txn: `Payee=Apple, Amount=$14.99, Date=2026-04-15, Account=Credit Card`
- Correlation search finds: `Payee=Apple Music, Amount=$14.99, Date=2026-04-15, Account=...` already categorized as `Entertainment` in a prior month (recurring).
- ✅ Assign `Entertainment`.

### Worked example (Amazon)

- New txn: `Payee=Amazon, Amount=$47.22, Date=2026-04-10`
- No sibling-account match, but a prior Amazon txn of $47.22 on 2026-02-10 was manually categorized as `Household`.
- ✅ Use historical exact-amount recurrence as a signal (weaker than cross-account, but usable).

## Why this is generalizable

The feature should NOT be hardcoded for Apple. Design as a **reusable Stage 1.5 resolver**:

- Config: `ambiguousPayees: string[]` (or regex list) — e.g. `["Apple", "Amazon", "PayPal", "Google", "Square"]`
- Reusable `CorrelationResolver` class with tunable params: `amountTolerance`, `dateWindowDays`, `requireCrossAccount`, `minConfidence`
- Slots into existing pipeline *between* `PatternEngine.evaluate` and `IdentityResolver.resolveMerchant` in `src/index.ts`

## Relevant code

- `src/index.ts` — main pipeline (Stage 1/2/3); insertion point ~line 90 (after `patternMatch`, before `IdentityResolver`)
- `src/ynab.ts` — `getTransactionsByPayee(payeeId)` already exists; may need `getTransactionsByAmount(amount, dateRange)` or a broader `getAllTransactions` + in-memory filter
- `src/pattern-engine.ts` — existing `RuleType` union (`exact | regex | fuzzy | temporal`) — could add `'correlation'` rule type, or keep the resolver as a separate module

## Acceptance Criteria
<!-- AC:BEGIN -->
- New `CorrelationResolver` module with unit tests covering: exact-amount+same-day match, window match, no match, multiple candidates (ambiguous), cross-account preference
- Ambiguous payee list configurable via env or config file
- Integrated into `src/index.ts` pipeline as Stage 1.5 with logging at each decision point
- Apple-specific validation: run against real YNAB history and verify ≥80% of Apple txns get a correct category assignment without LLM fallback
- Falls through cleanly to existing LLM stages when no correlation found
<!-- SECTION:DESCRIPTION:END -->

- [ ] #1 New CorrelationResolver module exists with amountTolerance, dateWindowDays, requireCrossAccount, minConfidence params
- [ ] #2 Ambiguous payee list is configurable (not hardcoded to Apple)
- [ ] #3 Correlates on (amount, date) across all accounts, preferring cross-account matches with concrete categories
- [ ] #4 Integrated as Stage 1.5 in src/index.ts between PatternEngine and IdentityResolver
- [ ] #5 Unit tests cover: exact match, window match, no match, multiple candidates, cross-account preference, historical recurrence
- [ ] #6 Validated against real YNAB Apple transactions: ≥80% correct category assignment without LLM fallback
- [ ] #7 Falls through cleanly to existing LLM stages when correlation yields no confident match
- [ ] #8 Logs every decision (match found / ambiguous / no match) with reasoning
<!-- AC:END -->
