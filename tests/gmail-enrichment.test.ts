import { describe, it, expect, vi } from 'vitest';
import type { LanguageModel } from 'ai';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: generateTextMock,
  };
});

import {
  enrichTransactionWithGmail,
  isPayeeGmailEligible,
  DEFAULT_ENRICHMENT_CONFIG,
} from '../src/gmail-enrichment.js';
import type { GmailClient, TransactionEmail } from '../src/gmail.js';

function mockGmailClient(emails: TransactionEmail[]): GmailClient {
  return {
    getEmailsAroundDate: vi.fn().mockResolvedValue(emails),
  } as unknown as GmailClient;
}

const dummyModel = {} as LanguageModel;

describe('isPayeeGmailEligible', () => {
  it('matches case-insensitive substrings', () => {
    expect(isPayeeGmailEligible('AFTERPAY AU', ['afterpay'])).toBe(true);
    expect(isPayeeGmailEligible('PAYPAL *Spotify', ['paypal'])).toBe(true);
    expect(isPayeeGmailEligible('Walmart', ['afterpay', 'paypal'])).toBe(false);
    expect(isPayeeGmailEligible(null, ['afterpay'])).toBe(false);
  });
});

describe('enrichTransactionWithGmail', () => {
  const categories = [
    { id: 'cat-dining', name: 'Dining' },
    { id: 'cat-clothing', name: 'Clothing' },
    { id: 'cat-household', name: 'Household' },
  ];

  it('returns null when payee is not eligible', async () => {
    const client = mockGmailClient([]);
    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Walmart',
      dateStr: '2026-04-15',
      amountMilliunits: -45000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
    });
    expect(result).toBeNull();
    expect(client.getEmailsAroundDate).not.toHaveBeenCalled();
  });

  it('returns null when no emails are returned', async () => {
    const client = mockGmailClient([]);
    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Afterpay',
      dateStr: '2026-04-15',
      amountMilliunits: -45000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
    });
    expect(result).toBeNull();
  });

  it('returns single-category result when receipt has one line item', async () => {
    const client = mockGmailClient([
      {
        id: 'msg-1',
        from: 'noreply@afterpay.com',
        subject: 'Your order',
        date: new Date('2026-04-15'),
        bodyText: 'Your order from Cotton On is confirmed.\nT-Shirt Blue $45.00\nOrder Total $45.00\n',
      },
    ]);

    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Afterpay',
      dateStr: '2026-04-15',
      amountMilliunits: -45000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
    });

    expect(result).not.toBeNull();
    expect(result!.receipt.merchant).toContain('Cotton On');
    expect(result!.receipt.totalAmount).toBeCloseTo(45.0);
    expect(result!.emailId).toBe('msg-1');
    expect(result!.merchantContext).toContain('Cotton On');
    expect(result!.subtransactions).toBeUndefined();
  });

  it('filters out receipts whose total does not match the transaction amount', async () => {
    const client = mockGmailClient([
      {
        id: 'msg-1',
        from: 'noreply@afterpay.com',
        subject: 'Your order',
        date: new Date('2026-04-15'),
        bodyText: 'Your order from Cotton On is confirmed.\nOrder Total $999.00\n',
      },
    ]);

    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Afterpay',
      dateStr: '2026-04-15',
      amountMilliunits: -45000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
    });

    expect(result).toBeNull();
  });

  it('swallows fetch errors and returns null (AC#6 fallback)', async () => {
    const client = {
      getEmailsAroundDate: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    } as unknown as GmailClient;

    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Afterpay',
      dateStr: '2026-04-15',
      amountMilliunits: -45000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
    });

    expect(result).toBeNull();
  });

  it('produces split subtransactions when LLM assigns multiple categories (AC#5)', async () => {
    const client = mockGmailClient([
      {
        id: 'msg-split',
        from: 'noreply@afterpay.com',
        subject: 'Your order',
        date: new Date('2026-04-15'),
        bodyText:
          'Your order from Woolworths is confirmed.\nMilk 2L $5.00\nDish Soap $8.00\nOrder Total $13.00\n',
      },
    ]);

    generateTextMock.mockReset();
    generateTextMock
      .mockResolvedValueOnce({ text: JSON.stringify({ categoryId: 'cat-dining', reasoning: 'food' }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ categoryId: 'cat-household', reasoning: 'cleaning' }) });

    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Afterpay',
      dateStr: '2026-04-15',
      amountMilliunits: -13000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
      aiModel: dummyModel,
    });

    expect(result).not.toBeNull();
    expect(result!.subtransactions).toBeDefined();
    expect(result!.subtransactions!.length).toBe(2);
    const catIds = result!.subtransactions!.map((s) => s.category_id);
    expect(catIds).toContain('cat-dining');
    expect(catIds).toContain('cat-household');
    expect(result!.subtransactions!.every((s) => s.amount < 0)).toBe(true);
  });

  it('returns single category when all LLM categorizations agree', async () => {
    const client = mockGmailClient([
      {
        id: 'msg-same',
        from: 'noreply@afterpay.com',
        subject: 'Your order',
        date: new Date('2026-04-15'),
        bodyText:
          'Your order from Country Road is confirmed.\nShirt $50.00\nPants $60.00\nOrder Total $110.00\n',
      },
    ]);

    generateTextMock.mockReset();
    generateTextMock
      .mockResolvedValueOnce({ text: JSON.stringify({ categoryId: 'cat-clothing', reasoning: 'apparel' }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ categoryId: 'cat-clothing', reasoning: 'apparel' }) });

    const result = await enrichTransactionWithGmail({
      transactionId: 't1',
      payeeName: 'Afterpay',
      dateStr: '2026-04-15',
      amountMilliunits: -110000,
      gmailClient: client,
      config: DEFAULT_ENRICHMENT_CONFIG,
      categories,
      aiModel: dummyModel,
    });

    expect(result).not.toBeNull();
    expect(result!.subtransactions).toBeUndefined();
    expect(result!.recommendedCategoryId).toBe('cat-clothing');
  });
});
