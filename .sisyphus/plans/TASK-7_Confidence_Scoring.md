## Plan: TASK-7 Confidence Scoring: Tiered System for Task-6

## TL;DR
> Define a formal, auditable confidence scoring system that governs Task-6 prompts across Stage-1 (deterministic), Stage-2 (LLM via Stage-1 context), and Stage-3 (fallback). Includes thresholds, decision rules, logging, QA scenarios, and a clean dependency on Task-6.

## Context
- This plan enables a clean separation of concerns: Task-6 uses score-driven gating to decide when to auto-apply, auto-suggest, request human review, or escalate. Task-7 is a hard prerequisite for Task-6 stages 2/3.
- Gateways feed back into Task-6 plan inputs and evidence trails.

## Work Objectives
- Define score ranges and corresponding actions for Stage-1, Stage-2, and Stage-3 outputs.
- Specify mapping rules from scores to actions (e.g., Auto, Auto-with-Minor-Review, Review, Escalate).
- Detail provenance and logging requirements to ensure auditable decisions.
- Provide QA scenarios (happy path and edge cases) to validate scoring behavior.
- Establish integration hooks so Task-6 can consume Task-7 outputs.

## Definition of Done (DoD)
- All scoring ranges, thresholds, and decision rules are written and testable.
- Provenance schema is defined; log fields are enumerated.
- QA scenarios and expected outcomes documented.
- Task-6 references Task-7 outputs unambiguously.

## Acceptance Criteria
- [ ] Stage-1/Stage-2/Stage-3 decision rules defined with explicit thresholds.
- [ ] Outputs include confidence scores and provenance for auditable decisions.
- [ ] QA scenarios for happy path and edge cases defined.
- [ ] Integration points with Task-6 clearly specified.
- [ ] Task-5 gating considerations reflected in the scoring model.

## QA Scenarios (Examples)
- Happy path: Stage-1 confidently maps a transaction; no Stage-2 needed.
- Edge: Stage-1 inconclusive; Stage-2 returns a mapping with a low confidence; Stage-3 resolves.
- Edge: Ambiguous payee; escalates to human review.

## Execution Strategy
- Plan is executed as a companion artifact to Task-6. No runtime changes here; this defines inputs/outputs for Task-6’s decision gates.
- Dependencies: TASK-6 (consumes Task-7 outputs), TASK-5 (availability of account heuristics if needed).

## Dependencies
- TASK-6: consumes outputs and gating rules.
- TASK-5: gating signals for account heuristics (when applicable).

## References
- Task-6 plan path: .sisyphus/plans/TASK-6_Contextual-Prompting.md
