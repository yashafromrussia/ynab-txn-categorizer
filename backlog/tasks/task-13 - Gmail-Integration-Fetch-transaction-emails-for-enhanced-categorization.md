---
id: TASK-13
title: 'Gmail Integration: Fetch transaction emails for enhanced categorization'
status: To Do
assignee: []
created_date: '2026-04-19 02:19'
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
- [ ] #1 Gmail API authentication flow implemented with secure token storage
- [ ] #2 Service can fetch emails within a configurable date range around transaction date
- [ ] #3 Email parser handles common receipt formats from Afterpay, Apple Pay, PayPal
- [ ] #4 Extracted order items are matched to appropriate YNAB categories
- [ ] #5 Support for split transactions when multiple categories are detected
- [ ] #6 Fallback to existing categorization when no matching email is found
- [ ] #7 Rate limiting and error handling for Gmail API interactions
- [ ] #8 Configuration for enabling/disabling email lookup per payee
- [ ] #9 Privacy-focused: only fetch/parse transaction-related emails, no storage of email content
<!-- AC:END -->
