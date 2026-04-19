## Plan: TASK-7 Confidence Scoring: Tiered System for Task-6

## TL;DR
> Define a formal, auditable confidence scoring system that governs Task-6 prompts across Stage-1 (deterministic), Stage-2 (LLM via Stage-1 context), and Stage-3 (fallback). Includes thresholds, decision rules, logging, QA scenarios, and a clean dependency on Task-6.

## Context
- This plan enables a clean separation of concerns: Task-6 uses score-driven gating to decide when to auto-apply, auto-suggest, request human review, or escalate. Task-7 is a hard prerequisite for Task-6 stages 2/3.
- Gateways feed back into Task-6 plan inputs and evidence trails.

## 1. Confidence Scoring Thresholds & Decision Rules

A standardized confidence score ranging from **0.0 to 1.0** will be used across all evaluation stages. The decision to auto-categorize, prompt for review, or escalate is governed by these rigid thresholds:

| Tier | Score Range | Action | Description |
|---|---|---|---|
| **Tier 1: Auto-Assign** | `0.95 - 1.0` | **Auto** | System applies category directly via YNAB API. Requires high certainty (e.g., Stage-1 deterministic match, or LLM with exact historical precedent). |
| **Tier 2: Auto-with-Minor-Review** | `0.80 - 0.94` | **Suggest (High)** | Proposed to the user in a batch UI. The user can "Approve All" safely. |
| **Tier 3: Review Required** | `0.50 - 0.79` | **Review** | Proposed to the user, but highlighted as needing explicit attention. Ambiguity exists (e.g. multiple possible categories with similar likelihood). |
| **Tier 4: Escalate / Manual** | `< 0.50` | **Escalate** | System makes no prediction, or provides unselected options. Flags transaction for full manual categorization by user. |

### Stage-Specific Rules:
- **Stage-1 (Deterministic)**: Matches here inherently receive `1.0` (Auto) unless the rule is configured as a "fuzzy/weak" rule, which caps at `0.85` (Tier 2). Payees gated by history (e.g. Afterpay) immediately score `0.0` here, forcing escalation or Stage-2 review.
- **Stage-2 (Contextual LLM)**: LLM must output a `confidence` float. Output is clipped between `0.1` and `0.99`. LLMs cannot score a perfect `1.0`. Any LLM output above `0.95` becomes Auto-Assign.
- **Stage-3 (Fallback LLM)**: By definition, Stage-3 only handles ambiguous cases. Maximum score from Stage-3 is capped at `0.79` (Tier 3), enforcing human review.

## 2. Data Provenance and Logging Schema

To ensure all decisions are fully auditable, every categorized transaction must persist a `CategorizationTrace` log.

**Schema (`CategorizationTrace`):**
```json
{
  "transaction_id": "string",
  "payee_name": "string",
  "assigned_category_id": "string | null",
  "confidence_score": 0.0,
  "tier": "Auto | Suggest | Review | Escalate",
  "stage_resolved": "1 | 2 | 3 | null",
  "signals_used": {
    "deterministic_rule_id": "string | null",
    "calendar_event_id": "string | null",
    "search_identity_resolved": "boolean",
    "account_heuristic_applied": "boolean"
  },
  "llm_reasoning": "string | null",
  "timestamp": "iso8601"
}
```

**Logging Rules:**
- Stage-1 traces omit `llm_reasoning`.
- Task-5 account hints must set `account_heuristic_applied: true`.
- Logs are stored in a local SQLite DB or structured JSON log file for presentation in the Review UI (Task-4).

## 3. QA Scenarios

### Happy Path 1: Deterministic Match (Stage 1)
- **Input**: Payee="Netflix", matches exact rule.
- **Outcome**: Score `1.0`, Tier: **Auto**. Stage-2 bypassed. Log shows `stage_resolved: 1`.

### Happy Path 2: Strong Contextual Match (Stage 2)
- **Input**: Payee="Square *Coffee", unmapped. Stage-1 inconclusive. Stage-2 LLM sees calendar event "Coffee with Bob" at the same time.
- **Outcome**: LLM outputs `0.96`. Tier: **Auto-Assign**.

### Edge Case 1: Multi-Merchant Payee / Ambiguous
- **Input**: Payee="PayPal", no temporal or account heuristics point to a specific purchase.
- **Outcome**: Stage-1 blocked (history gating). Stage-2 LLM outputs confidence `0.45` due to lack of distinct context.
- **Action**: Tier: **Escalate** (`< 0.50`). User must manually review.

### Edge Case 2: Conflicting Signals
- **Input**: Payee="Target". Account is "Business Credit Card" (Task-5 heuristic suggests "Office Supplies" +0.3). But calendar shows "Buy Groceries".
- **Outcome**: Stage-2 LLM balances conflicting signals. Confidence comes out to `0.75`.
- **Action**: Tier: **Review Required**. System proposes "Groceries" and "Office Supplies" but requires user selection.

## 4. Integration with Task-6 (Contextual Prompting)

- **Input to Task-6**: Task-6 prompt templates must instruct the LLM to strictly output a JSON object containing `confidence_score` (float 0.0-1.0) and `reasoning`.
- **Output from Task-6**: Task-6 execution logic will evaluate the LLM's `confidence_score` against the Tier thresholds defined above.
- **Task-5 Dependency**: The prompt will include a specific section: `Account Heuristics Applied: [List from Task-5]`. If present, the LLM is instructed to appropriately incorporate it into the decision and `confidence_score`.

## Definition of Done (DoD)
- [x] All scoring ranges, thresholds, and decision rules are written and testable.
- [x] Provenance schema is defined; log fields are enumerated.
- [x] QA scenarios and expected outcomes documented.
- [x] Task-6 references Task-7 outputs unambiguously.

## Acceptance Criteria
- [x] Stage-1/Stage-2/Stage-3 decision rules defined with explicit thresholds.
- [x] Outputs include confidence scores and provenance for auditable decisions.
- [x] QA scenarios for happy path and edge cases defined.
- [x] Integration points with Task-6 clearly specified.
- [x] Task-5 gating considerations reflected in the scoring model.

## Execution Strategy
- Plan is executed as a companion artifact to Task-6. No runtime changes here; this defines inputs/outputs for Task-6’s decision gates.
- Dependencies: TASK-6 (consumes Task-7 outputs), TASK-5 (availability of account heuristics if needed).

## References
- Task-6 plan path: `.sisyphus/plans/TASK-6_Contextual-Prompting.md`
