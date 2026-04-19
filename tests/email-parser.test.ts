import { describe, it, expect } from 'vitest';
import { parseReceipt, parseAfterpay, parseApplePay, parsePaypal } from '../src/email-parser.js';
import type { TransactionEmail } from '../src/gmail.js';

function email(partial: Partial<TransactionEmail>): TransactionEmail {
  return {
    id: 'msg-1',
    from: 'noreply@afterpay.com',
    subject: '',
    date: new Date('2026-04-15T12:00:00Z'),
    bodyText: '',
    ...partial,
  };
}

describe('parseAfterpay', () => {
  it('extracts merchant and line items from a typical Afterpay receipt', () => {
    const body = `
Hi there,

Your order from The Iconic is confirmed.

T-Shirt Blue $29.99
Jeans Slim Fit $79.00
Shipping $5.00

Order Total $113.99

Thanks for shopping with Afterpay.
`;
    const result = parseAfterpay(email({ subject: 'Your Afterpay order', bodyText: body }));
    expect(result).not.toBeNull();
    expect(result!.source).toBe('afterpay');
    expect(result!.merchant).toBe('The Iconic');
    expect(result!.totalAmount).toBeCloseTo(113.99);
    const descriptions = result!.lineItems.map(i => i.description);
    expect(descriptions).toContain('T-Shirt Blue');
    expect(descriptions).toContain('Jeans Slim Fit');
    expect(descriptions).not.toContain('Shipping');
    expect(descriptions).not.toContain('Order Total');
  });

  it('returns null when sender is not Afterpay', () => {
    const result = parseAfterpay(email({ from: 'noreply@other.com', bodyText: 'Order total $10.00' }));
    expect(result).toBeNull();
  });

  it('returns null when body contains no recognizable receipt info', () => {
    const result = parseAfterpay(email({ bodyText: 'Welcome to Afterpay!' }));
    expect(result).toBeNull();
  });
});

describe('parseApplePay', () => {
  it('extracts single-item App Store receipt', () => {
    const body = `
Your receipt from Apple

Spotify Premium Subscription Monthly $11.99

Order Total $11.99
`;
    const result = parseApplePay(
      email({
        from: 'no_reply@email.apple.com',
        subject: 'Your receipt from Apple',
        bodyText: body,
      })
    );
    expect(result).not.toBeNull();
    expect(result!.source).toBe('applepay');
    expect(result!.merchant).toBe('Apple');
    expect(result!.totalAmount).toBeCloseTo(11.99);
    expect(result!.lineItems.length).toBeGreaterThanOrEqual(1);
    expect(result!.lineItems[0].description).toContain('Spotify Premium');
  });

  it('rejects non-Apple sender without Apple-ish subject', () => {
    const result = parseApplePay(email({ from: 'random@example.com', subject: 'Hello', bodyText: 'Total $10.00' }));
    expect(result).toBeNull();
  });
});

describe('parsePaypal', () => {
  it('extracts merchant and total from a PayPal payment receipt', () => {
    const body = `
You sent a payment of $45.00 USD to Bunnings Warehouse.

Item: Garden Hose 30m
Item: Pruning Shears

Total $45.00
`;
    const result = parsePaypal(
      email({
        from: 'service@paypal.com',
        subject: 'Receipt for your payment to Bunnings',
        bodyText: body,
      })
    );
    expect(result).not.toBeNull();
    expect(result!.source).toBe('paypal');
    expect(result!.merchant).toContain('Bunnings');
    expect(result!.totalAmount).toBeCloseTo(45.0);
  });

  it('returns null when sender is not PayPal', () => {
    const result = parsePaypal(email({ from: 'mail@other.com', bodyText: 'Total $10.00' }));
    expect(result).toBeNull();
  });
});

describe('parseReceipt dispatcher', () => {
  it('routes to Afterpay parser for Afterpay sender', () => {
    const result = parseReceipt(
      email({
        from: 'noreply@afterpay.com',
        bodyText: 'Your order from Cotton On is confirmed.\nOrder Total $25.00\n',
      })
    );
    expect(result?.source).toBe('afterpay');
  });

  it('routes to PayPal parser for PayPal sender', () => {
    const result = parseReceipt(
      email({
        from: 'service@paypal.com',
        bodyText: 'You sent a payment of $9.99 USD to Spotify.\nTotal $9.99\n',
      })
    );
    expect(result?.source).toBe('paypal');
  });

  it('returns null when no parser matches', () => {
    const result = parseReceipt(email({ from: 'newsletter@example.com', bodyText: 'Hello' }));
    expect(result).toBeNull();
  });
});
