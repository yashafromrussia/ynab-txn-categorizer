---
id: TASK-12
title: >-
  Spike: Evaluate multi-agent vs. MCP server architecture for categorization
  pipeline
status: To Do
assignee: []
created_date: '2026-04-19 00:22'
labels:
  - spike
  - architecture
  - ai
dependencies:
  - TASK-11
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The current pipeline (`src/index.ts`, `src/contextual-prompting.ts`) is a **linear 3-stage cascade** executed per transaction:

1. **Stage 1 — Deterministic**: `PatternEngine` + historical payee count + multi-merchant gating
2. **Stage 2 — Fast LLM**: single prompt with pre-stuffed context (calendar events, Brave-resolved merchant info, category list) → category ID or `INCONCLUSIVE`
3. **Stage 3 — Deep LLM**: reasoning prompt → JSON (`reasoning`, `confidence`, `recommendedCategoryId`)

Enrichment (Calendar, Brave Search, YNAB history) is **eagerly computed upfront** and dumped into the prompt regardless of whether the signal is needed. The orchestrator is hard-coded control flow.

This spike investigates whether restructuring into **(A) a multi-agent system** or **(B) an MCP server** yields meaningful wins over the current cascade — or whether the current design is actually the right shape and should just be incrementally improved.

## Why this matters

Symptoms suggesting the current shape may be limiting:
- Context is over-fetched (Brave call + calendar lookup happen even when Stage 1 would resolve)
- Signals are flattened into one prompt — the model can't interrogate or re-query
- Hard to introduce new signals (e.g., location, statement memo parsing) without editing the monolithic prompt builder
- No way for a human or external LLM (Claude Desktop, Cursor) to reuse these categorization capabilities interactively

## Three architectures to compare

### Option A — Keep cascade, tighten it (baseline / null hypothesis)
Incremental: lazy enrichment, structured output via `generateObject`, better confidence thresholds. No architectural change.
- Pro: lowest risk, preserves current test coverage
- Con: ceiling on flexibility, still monolithic

### Option B — Multi-agent (specialist ensemble)
Decompose into specialist agents that run in parallel (or conditionally), each emitting `{ categoryId, confidence, rationale }`. An **Arbiter** agent reconciles votes.
- Candidate specialists: `PayeeIdentityAgent` (Brave + LLM), `TemporalAgent` (calendar correlation), `HistoryAgent` (payee ledger analysis), `PatternAgent` (deterministic rules), `AmbiguousPayeeAgent` (TASK-11 correlation logic)
- Pro: isolated prompts are testable; easy to add/remove specialists; natural parallelism; explainable votes
- Con: cost (N LLM calls instead of 1–2); arbitration is its own hard problem; risk of agreement-bias
- Frameworks to consider: Vercel AI SDK's `generateText` with tool-calling loop, Mastra, or a thin hand-rolled ensemble

### Option C — MCP server (tool-provider shape)
Expose categorization primitives as **MCP tools** consumed by an external agent (Claude Desktop, Cursor, a local agent loop):
- Tools: `ynab.getUncategorizedTransactions`, `ynab.getPayeeHistory`, `calendar.getEventsAroundDate`, `merchant.resolveIdentity`, `patterns.evaluate`, `ynab.applyCategory`
- The **agent decides** which tools to call, in what order, and when it has enough signal
- Pro: reusable across clients; turns the app into a platform; human-in-the-loop via Claude Desktop becomes trivial; aligns with where the ecosystem is heading
- Con: loses the opinionated orchestration that encodes domain knowledge; cost/latency depend on client agent; requires an MCP runtime

### Option D — Hybrid (likely winner, worth validating)
Cascade stays as the **fast path** (Stage 1 deterministic); Stages 2–3 are replaced by an **agent with tool access** (same tools as Option C's MCP server, exposed either internally or via MCP). Best of both: cheap deterministic short-circuit + flexible agentic reasoning with lazy enrichment. MCP server can be a thin wrapper over the same tool layer.

## Direction / suggested approach

1. **Build an eval harness first** (this is the bottleneck — without it, all comparisons are vibes). Take ~30–50 real uncategorized transactions, hand-label correct categories, measure: accuracy, cost ($), latency, # of tool/LLM calls per tx.
2. **Refactor enrichment into a tool layer** (pure functions: `getPayeeHistory`, `getCalendarContext`, `resolveMerchant`, `evaluatePatterns`). This is strictly additive and unblocks B/C/D.
3. **Prototype Option D** (cascade + tool-calling agent for Stage 2+) against the eval set. This is the cheapest way to validate whether agentic flexibility actually wins.
4. **Prototype Option C** by wrapping the same tool layer in an MCP server (using `@modelcontextprotocol/sdk`). Minimal extra work once step 2 is done.
5. **Write a decision doc** in `backlog/decisions/` comparing A/B/C/D against the eval harness results. Recommend one architecture and migration path.

Explicitly **not** doing Option B (full specialist ensemble) in this spike unless D's results suggest single-agent orchestration is insufficient — the cost multiplier is hard to justify without evidence.

## Open questions to resolve during the spike

- Is Stage 3's JSON-with-reasoning output being used anywhere downstream, or is it write-only? (affects whether structured output matters)
- How often does Stage 1 actually resolve in practice? (determines whether cascade short-circuit is valuable)
- Is the goal interactive use (Claude Desktop) or batch autonomous categorization? (biases toward C vs. D)
- Budget ceiling per transaction in $ / tokens?

## Scope boundaries

**IN**: eval harness, tool-layer refactor, Option D prototype, Option C (MCP) prototype, decision doc
**OUT**: full multi-agent ensemble (B) implementation, production rollout, UI integration with TASK-8
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eval harness exists with ≥30 hand-labeled transactions and reports accuracy, cost, latency, and tool-call count per architecture
- [ ] #2 Enrichment logic (calendar, brave, history, patterns) is extracted into a pure tool layer callable from any orchestrator
- [ ] #3 Option D (cascade + tool-calling agent) prototype runs against the eval set and has reported metrics
- [ ] #4 Option C (MCP server) prototype exposes ≥4 tools and is verified working with at least one MCP client (Claude Desktop or equivalent)
- [ ] #5 Decision doc in backlog/decisions/ compares all four options (A/B/C/D) against eval metrics and recommends one path with migration steps
- [ ] #6 Open questions from the spike description are answered in the decision doc with evidence
<!-- AC:END -->
