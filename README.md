# YNAB Intelligent Categorizer

An intelligent orchestration layer that synthesizes internal YNAB history and external life context (Calendar, Web Search) to automatically categorize uncategorized transactions using a combination of deterministic pattern matching and LLM-powered reasoning.

## 🎯 Vision
To eliminate the manual effort of transaction categorization by creating a "Financial Librarian" that understands not just *where* money was spent, but *why* it was spent based on the user's real-world activities.

## 🗺️ Roadmap

### Phase 1: The Foundation (Deterministic Layer)
- [x] **YNAB Integration**: OAuth flow and endpoints for uncategorized transactions and historical ledger.
- [x] **Pattern Engine**: Fuzzy matching and regex rules for recurring merchants.

### Phase 2: The Context Engine (Enrichment Layer)
- [x] **Temporal Correlation**: Google Calendar integration to match transaction timestamps with scheduled events.
- [x] **Identity Resolution**: Google Search/LLM integration to identify obscure merchant names.
- [x] **Account Heuristics**: Weighting categories based on the source account.

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

## 🚀 Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example environment file and fill in your credentials.
   ```bash
   cp .env.example .env
   ```
   
   **Required configuration:**
   - **YNAB**: `YNAB_ACCESS_TOKEN`, `YNAB_BUDGET_ID`
   - **Google Calendar (Temporal Correlation)**: `GOOGLE_CALENDAR_ID`, `GOOGLE_API_KEY` (or `GOOGLE_APPLICATION_CREDENTIALS` path)
   - **Google Search (Identity Resolution)**: `GOOGLE_SEARCH_ENGINE_ID`
   - **LLM Provider (AI SDK)**: Define `AI_MODEL` using the `provider:model` syntax (e.g., `openai:gpt-4o-mini`, `google:gemini-1.5-pro`, `anthropic:claude-3-haiku-20240307`). Provide the corresponding API key (`OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`). Custom OpenAI-compatible endpoints can be used by setting `OPENAI_BASE_URL` (useful for Ollama, vLLM, or OpenRouter).

## 📝 Rule Configuration

The categorization logic uses a `PatternEngine` to match transaction payees or contextual events to YNAB Category IDs. Rules are added programmatically in `src/index.ts`.

Currently, four types of rules are supported:

### 1. Exact Match (`exact`)
Matches the payee name exactly (case-insensitive).
```typescript
engine.addRule({
  id: 'rule-exact-netflix',
  type: 'exact',
  pattern: 'Netflix',
  categoryId: 'YNAB-Category-ID'
});
```

### 2. Regular Expression (`regex`)
Evaluates the payee name against a regular expression.
```typescript
engine.addRule({
  id: 'rule-regex-uber',
  type: 'regex',
  pattern: '^Uber.*',
  categoryId: 'YNAB-Category-ID'
});
```

### 3. Fuzzy Match (`fuzzy`)
Calculates the Levenshtein distance between the payee and the pattern. Good for catching typos or slight variations. Also passes if the payee simply contains the pattern as a substring.
```typescript
engine.addRule({
  id: 'rule-fuzzy-walmart',
  type: 'fuzzy',
  pattern: 'walmart',
  categoryId: 'YNAB-Category-ID',
  maxDistance: 3 // Optional, defaults to 3
});
```

### 4. Temporal Context (`temporal`)
Evaluates the pattern against Google Calendar event summaries and descriptions happening on the same day as the transaction.
```typescript
engine.addRule({
  id: 'rule-temporal-flight',
  type: 'temporal',
  pattern: 'flight', // Looks for the word "flight" in calendar events
  categoryId: 'Travel-Category-Id'
});
```

To configure your own rules, update the `engine.addRule(...)` calls in `src/index.ts`. You will also need to update the `knownCategories` object mapping in `src/index.ts` to improve Identity Resolution.

## 🏃‍♂️ Running the Application

**Development Mode** (uses `tsx` to run TypeScript directly):
```bash
npm run dev
```

**Production Build**:
```bash
npm run build
npm start
```

**Run Tests**:
```bash
npm test
```
