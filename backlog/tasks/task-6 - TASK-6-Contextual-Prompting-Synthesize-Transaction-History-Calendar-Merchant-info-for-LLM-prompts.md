---
id: TASK-6
title: >-
  TASK-6 Contextual Prompting: Synthesize Transaction + History + Calendar +
  Merchant info for LLM prompts
status: To Do
assignee: []
created_date: '2026-04-17 13:15'
updated_date: '2026-04-17 23:26'
labels:
  - planning
  - task-6
  - ai-integration
milestone: TASK-6
dependencies:
  - TASK-5
  - TASK-7
references:
  - .sisyphus/plans/TASK-6_Contextual-Prompting.md
priority: high
ordinal: 0
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan direction (decision-complete) for Task-6:
- History signal gating: Do not auto-assign for multi-merchant payees (e.g., Afterpay) unless clearly separable by amount; Afterpay integration remains optional future work.
- Two-stage prompting: Stage-1 deterministic mapping with signals; Stage-2 prompts created from Stage-1 outputs plus full category list; Stage-3 prompts only if Stage-1 inconclusive.
- No batching: Evaluate items individually; no parallel prompt batching.
- Task-5 prerequisites: Treat Task-5 as a hard prerequisite for Stage-2/Stage-3 prompts.
- Guardrails: Explicit decision criteria, traceable inputs->outputs, and escalation path to human review for ambiguous cases.
- Optional future extension: Afterpay API integration noted but not included in Task-6 scope.
- Deliverable: A compact plan skeleton saved to .sisyphus/plans/TASK-6_Contextual-Prompting.md with sections for decisions, scope, execution, DoD, acceptance criteria, Metis findings, and open questions.

Acceptance Criteria (summary):
- Stage-1 defined with gating rules; Stage-1 mappings have auditable inputs and decisions; majority of cases confidently mapped without Stage-2.
- Stage-2 prompts produced and executed only when Stage-1 inconclusive; inputs include Stage-1 results and full category list; no batching.
- Stage-3 prompts exist only for unresolved Stage-1 items; final decision or documented rationale produced.
- Task-5 prerequisites completed and consumed by Stage-2/Stage-3.
- Plan references to the plan file path and Metis guardrails included.

Definition of Done (DoD) items: see plan; Plan saved to .sisyphus/plans/TASK-6_Contextual-Prompting.md.

References:
- Plan artifact path: .sisyphus/plans/TASK-6_Contextual-Prompting.md
- Task-5 prerequisite and gating relationships.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stage-1 deterministic mapping defined with payee gating and history-based signals; gating excludes Afterpay-like multi-merchant payees unless explicitly overridable.
- [ ] #2 Stage-2 prompts constructed from Stage-1 outputs + full category list; executed sequentially (no batching); results are auditable and provenance-traced.
- [ ] #3 Stage-3 prompts exist only for unresolved Stage-1 items; final decision or documented rationale produced with explicit confidence and cross-checks.
- [ ] #4 Task-5 prerequisites completed and accessible; Stage-2/Stage-3 prompts reference Task-5 outputs unambiguously.
- [ ] #5 Metis guardrails incorporated: no auto-assign on uncertain payees; Afterpay as optional; full traceability; escalation path to human review when necessary.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Plan artifact saved to .sisyphus/plans/TASK-6_Contextual-Prompting.md
- [ ] #2 All signals documented and traceable
- [ ] #3 Metis guardrails integrated
- [ ] #4 Plan references Task-5 gating and Afterpay extension noted as future work
<!-- DOD:END -->
