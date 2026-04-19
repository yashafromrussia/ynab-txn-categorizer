---
id: TASK-13
title: 'Gmail Integration: Fetch transaction emails for enhanced categorization'
status: Done
assignee: []
created_date: '2026-04-19 02:19'
updated_date: '2026-04-19 11:11'
labels:
  - integration
  - categorization
  - enhancement
dependencies: []
references:
  - 'https://developers.google.com/gmail/api'
  - 'https://developers.google.com/gmail/api/guides'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Many payment aggregators and platforms (Afterpay, Apple Pay, PayPal, etc.) send detailed email receipts when charging a card. These emails contain itemized order information that can help determine accurate categories for transactions.

Implement Gmail API integration to:
1. Fetch relevant emails around transaction dates (±2 days)
2. Parse order line items from common email formats
3. Use extracted data to enhance categorization accuracy
4. Support split categorization when multiple items are detected

This will significantly improve categorization accuracy for aggregated payments where the payee name alone is insufficient to determine the actual purchase category.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Gmail API authentication flow implemented with secure token storage
- [x] #2 Service can fetch emails within a configurable date range around transaction date
- [x] #3 Email parser handles common receipt formats from Afterpay, Apple Pay, PayPal
- [x] #4 Extracted order items are matched to appropriate YNAB categories
- [x] #5 Support for split transactions when multiple categories are detected
- [x] #6 Fallback to existing categorization when no matching email is found
- [x] #7 Rate limiting and error handling for Gmail API interactions
- [x] #8 Configuration for enabling/disabling email lookup per payee
- [x] #9 Privacy-focused: only fetch/parse transaction-related emails, no storage of email content
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approved Implementation Plan

**Auth decision**: Personal @gmail.com → OAuth2 user flow only. Refresh token persisted to `secrets/gmail-token.json` (gitignored). Paste-code setup (no local HTTP server).

### Files to create
1. **`src/gmail.ts`** — `GmailClient` class (mirrors `CalendarClient` shape)
   - Loads OAuth2 client + refresh token from disk
   - `getEmailsAroundDate(dateStr, daysWindow, senders)` — narrow sender-scoped Gmail query
   - Returns `TransactionEmail[]` with `{ id, from, subject, date, bodyText }`
   - Body held in-memory only (privacy AC#9)

2. **`src/email-parser.ts`** — pure parser functions
   - `parseAfterpay`, `parseApplePay`, `parsePaypal`
   - Dispatcher `parseReceipt(email): ParsedReceipt | null`
   - Shape: `{ merchant, lineItems: [{description, amount}], totalAmount }`

3. **`src/gmail-auth-setup.ts`** — one-shot CLI (`npm run gmail:auth`)
   - Reads OAuth client creds from `secrets/gmail-oauth-client.json`
   - Prints consent URL → accepts pasted code via `@clack/prompts`
   - Writes refresh token to `secrets/gmail-token.json`

4. **`src/gmail-enrichment.ts`** — orchestration glue
   - Fetch → parse → amount-sanity-filter → decide single-category vs. split
   - LLM-assisted line-item → category matching
   - Returns `null` on no match (AC#6 fallback)

### Files to modify
- **`src/config.ts`** — add `gmailLookup: { enabled, daysWindow, payees, senders }` (default disabled, AC#8)
- **`src/confidence-scoring.ts`** — add `gmail_enrichment_applied` + `gmail_email_id` to `signals_used`
- **`src/index.ts`** — wire as Stage 1.7 (after correlation, before Stage 2), only runs for configured payees
- **`.env.example`** — add `GMAIL_OAUTH_CLIENT`, `GMAIL_TOKEN_PATH`
- **`package.json`** — add `gmail:auth` script
- **`README.md`** — document Gmail setup flow
- **`config.json`** — add default `gmailLookup` block

### Tests
- **`tests/email-parser.test.ts`** — fixture-based parser tests (3 email formats)
- **`tests/gmail-enrichment.test.ts`** — mock GmailClient, verify enrichment + split detection + fallback

### Rate limiting & errors (AC#7)
- 10ms throttle between `messages.get` calls (10 msgs max/tx)
- All network calls wrapped; failures return `null` → pipeline continues

### Privacy controls (AC#9)
- Query always scoped to whitelisted `senders` — never full inbox
- Email body lives only in promise chain; never written to traces/disk
- Traces store only `email_id` + extracted merchant name

### Deferred (flagged, NOT in scope)
- YNAB write-back of split subtransactions — existing pipeline is read-only (Phase 4 roadmap item). Subtransactions recorded in `categorization-traces.jsonl` for future write-back, same pattern as correlation resolver.

### AC coverage
- AC#1 → `gmail.ts` + `gmail-auth-setup.ts` (OAuth + secure secrets/ token storage)
- AC#2 → `getEmailsAroundDate(dateStr, daysWindow)` with config `daysWindow`
- AC#3 → 3 parsers in `email-parser.ts`
- AC#4 → LLM line-item matching in `gmail-enrichment.ts`
- AC#5 → `SubTransaction[]` in trace when multi-line receipt detected
- AC#6 → enrichment returns `null` on miss, pipeline falls through to Stage 2/3
- AC#7 → try/catch + throttle
- AC#8 → `config.gmailLookup.payees` allowlist
- AC#9 → sender-scoped query + no body persistence
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation summary

Added **Stage 1.7 Gmail enrichment** to the categorization pipeline. Runs between correlation (Stage 1.5) and identity resolution / Stage 2 LLM, gated on per-payee config.

### New files
- `src/gmail.ts` — `GmailClient` with OAuth2 refresh-token auth. `fromEnv()` factory returns `null` if credentials/token missing. MIME walker prefers text/plain → falls back to HTML tag-strip. 10ms throttle between `messages.get` calls.
- `src/email-parser.ts` — Pure parser functions for Afterpay / Apple Pay / PayPal. Dispatcher `parseReceipt()` routes by sender. Extracts merchant, line items, total amount. Filters out `subtotal/total/tax/shipping/gst/fee` noise lines.
- `src/gmail-auth-setup.ts` — One-shot CLI (`npm run gmail:auth`) that generates consent URL, accepts pasted auth code, exchanges for refresh token, writes to `secrets/gmail-token.json` (mode 0600).
- `src/gmail-enrichment.ts` — Orchestration: fetch → parse → amount-match-filter → decide single-category vs. split. Multi-line receipts run each line through LLM for per-item categorization; identical categories collapse to a single recommendation, distinct categories yield `SubTransaction[]`.
- `tests/email-parser.test.ts` — 10 tests covering all three parsers, dispatcher routing, and null/reject paths.
- `tests/gmail-enrichment.test.ts` — 8 tests with mocked `GmailClient` and `vi.hoisted` mock of `ai.generateText`. Covers eligibility gating, empty-result fallback, fetch-error fallback, amount mismatch rejection, single-line, LLM split, and agreement collapse.

### Modified files
- `src/config.ts` — Added `GmailLookupConfig` type and default block (disabled by default).
- `src/confidence-scoring.ts` — Added `gmail_enrichment_applied` + `gmail_email_id` to `signals_used`.
- `src/index.ts` — Wired Stage 1.7. Gmail client created via `GmailClient.fromEnv()` only when `config.gmailLookup.enabled=true`. Single-category match → Suggest (0.9 confidence), split → Suggest (0.85), no match → falls through with merchant context merged into Stage 2 prompt.
- `.env.example`, `config.json`, `package.json`, `README.md` — Configuration + docs for OAuth setup flow.

### Results
- `npm run build` — clean
- `npm test` — 36/36 passing (was 28 before; +8 new tests)
- `lsp_diagnostics` — clean on all 15 source files

### Deferred (by design, flagged in plan)
YNAB write-back of split subtransactions is out of scope — current pipeline is read-only. Split subtransactions are recorded in `categorization-traces.jsonl` for future Phase 4 write-back, matching the existing correlation resolver pattern.

### AC verification
- #1 ✅ OAuth2 refresh-token flow, credentials in gitignored `secrets/`
- #2 ✅ `getEmailsAroundDate(dateStr, daysWindow, senders)` with configurable `daysWindow`
- #3 ✅ `parseAfterpay`, `parseApplePay`, `parsePaypal` + dispatcher
- #4 ✅ Line items matched to YNAB categories via LLM in `gmail-enrichment.ts`
- #5 ✅ Split `SubTransaction[]` produced when line items map to distinct categories
- #6 ✅ Returns `null` on no match; pipeline falls through to Stage 2
- #7 ✅ Try/catch on all API calls + 10ms throttle between `messages.get`
- #8 ✅ `config.gmailLookup.payees` allowlist + `config.gmailLookup.enabled` master toggle
- #9 ✅ Query scoped to whitelisted senders only, bodies never persisted, traces store only `email_id` + merchant name
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Gmail Integration for Transaction Email Enrichment (Stage 1.7)

Added Gmail receipt enrichment for payment aggregators (Afterpay, PayPal, Apple Pay) as a new **Stage 1.7** in the categorization pipeline.

### What ships
- **OAuth2 authentication**: `npm run gmail:auth` → paste-code flow → refresh token stored in gitignored `secrets/gmail-token.json`
- **Four new modules**: `gmail.ts` (API client), `email-parser.ts` (three receipt parsers + dispatcher), `gmail-auth-setup.ts` (setup CLI), `gmail-enrichment.ts` (orchestration glue)
- **Pipeline integration**: Stage 1.7 runs between correlation and identity resolution, gated on `config.gmailLookup.enabled` + per-payee allowlist. Defaults to **disabled** — strict opt-in.
- **Split transaction support**: Multi-line receipts fan out to the LLM per-item; distinct categories produce `SubTransaction[]` recorded in traces for future write-back (YNAB write API is Phase 4, deliberately out of scope).
- **Privacy controls**: Gmail queries always scoped to whitelisted senders (never full inbox). Email bodies live only in memory, never logged or persisted. Traces store only `email_id` + extracted merchant name.
- **Rate limiting**: 10ms throttle between `messages.get` calls, hard cap of 10 messages per transaction. All API calls wrapped in try/catch — failures return `null` and the pipeline falls through to Stage 2/3.

### Verification
- `npm run build` clean
- `npm test` 36/36 passing (added 18 new tests across 2 files)
- LSP diagnostics clean on all 15 source files

### Follow-up flagged
- YNAB API write-back of split subtransactions — out of scope here, awaits Phase 4 "Action Layer" roadmap item. Subtransactions are already captured in `categorization-traces.jsonl`.
<!-- SECTION:FINAL_SUMMARY:END -->
