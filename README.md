# YNAB Intelligent Categorizer

An intelligent orchestration layer that synthesizes internal YNAB history and external life context (Calendar, Web Search) to automatically categorize uncategorized transactions using a combination of deterministic pattern matching and LLM-powered reasoning.

## 🎯 Vision
To eliminate the manual effort of transaction categorization by creating a "Financial Librarian" that understands not just *where* money was spent, but *why* it was spent based on the user's real-world activities.

## 🗺️ Roadmap

### Phase 1: The Foundation (Deterministic Layer)
- [ ] **YNAB Integration**: OAuth flow and endpoints for uncategorized transactions and historical ledger.
- [ ] **Pattern Engine**: Fuzzy matching and regex rules for recurring merchants.

### Phase 2: The Context Engine (Enrichment Layer)
- [ ] **Temporal Correlation**: Google Calendar integration to match transaction timestamps with scheduled events.
- [ ] **Identity Resolution**: Google Search/LLM integration to identify obscure merchant names.
- [ ] **Account Heuristics**: Weighting categories based on the source account.

### Phase 3: The Intelligence Layer (LLM Orchestrator)
- [ ] **Contextual Prompting**: Synthesis of Transaction + History + Calendar + Merchant info.
- [ ] **Confidence Scoring**: Implementing a tiered confidence system (Auto-suggest vs. Review).

### Phase 4: The Closing Loop (Action Layer)
- [ ] **Review UI**: A human-in-the-loop interface for approving/correcting suggestions.
- [ ] **Batch Update**: Atomic category updates via YNAB API.

## 🛠️ Workstreams
- **API/Data**: YNAB, Google Calendar, Google Search.
- **Logic**: Pattern matching and data normalization.
- **AI**: Prompt engineering and confidence scoring.
