## Plan: TASK-6 Contextual Prompting: Synthesize Transaction + History + Calendar + Merchant info for LLM prompts

## TL;DR
> Implement a three-stage contextual prompting system for categorizing transactions. Focuses on history signal gating, treating Task-5 as a prerequisite, evaluating items individually (no batching), and establishing explicit guardrails to prevent erroneous auto-assignments for multi-merchant payees.

## Context & Metis Findings
- **History Signal Gating**: Do not auto-assign for multi-merchant payees (e.g., Afterpay, PayPal) unless clearly separable by amount. Afterpay API integration is noted as an optional future extension and is out of scope for Task-6.
- **Guardrails**: Require explicit decision criteria, traceable inputs-to-outputs, and an escalation path to human review for ambiguous cases. No auto-assigning uncertain payees.

## Scope & Decisions
- **Stage-1 (Deterministic)**: Deterministic mapping defined with payee gating and history-based signals. The majority of cases should confidently map here without needing an LLM.
- **Stage-2 (Contextual LLM)**: Constructed using Stage-1 outputs (signals, history) plus the full category list. Only executed if Stage-1 is inconclusive. Evaluates items sequentially (no batching).
- **Stage-3 (Fallback LLM)**: Exists only for unresolved Stage-1 items after Stage-2. Produces a final decision or a documented rationale for human review, incorporating explicit confidence and cross-checks.
- **No Batching**: Transactions must be evaluated individually to maximize LLM accuracy and traceability.
- **Prerequisites**: Task-5 (Account Heuristics) is a hard prerequisite for Stage-2/Stage-3 prompts. The prompts must reference Task-5 outputs unambiguously.

## Execution Strategy
1. **Stage-1 Implementation**: Build deterministic rules and gating logic to block ambiguous multi-merchant payees.
2. **Stage-2 Integration**: Create prompt templates that ingest Stage-1 context, transaction details, and Task-5 account weights.
3. **Stage-3 Fallback**: Develop the fallback reasoning prompt and human escalation pathway.
4. **Validation**: Test the multi-stage pipeline sequentially to ensure full traceability and adherence to guardrails.

## Definition of Done (DoD)
- [x] Plan artifact saved to `.sisyphus/plans/TASK-6_Contextual-Prompting.md`
- [ ] All signals documented and traceable.
- [ ] Metis guardrails integrated (prevent auto-assign on uncertain payees).
- [ ] Plan references Task-5 gating and Afterpay extension noted as future work.

## Acceptance Criteria
- [ ] Stage-1 deterministic mapping defined with payee gating and history-based signals; gating excludes Afterpay-like multi-merchant payees unless explicitly overridable.
- [ ] Stage-2 prompts constructed from Stage-1 outputs + full category list; executed sequentially (no batching); results are auditable and provenance-traced.
- [ ] Stage-3 prompts exist only for unresolved Stage-1 items; final decision or documented rationale produced with explicit confidence and cross-checks.
- [ ] Task-5 prerequisites completed and accessible; Stage-2/Stage-3 prompts reference Task-5 outputs unambiguously.
- [ ] Metis guardrails incorporated: no auto-assign on uncertain payees; Afterpay as optional; full traceability; escalation path to human review when necessary.

## Open Questions
- What exact format should the provenance trace take to ensure it is easily auditable by users?
- How should the escalation to human review be surfaced in the application UI or logging?
