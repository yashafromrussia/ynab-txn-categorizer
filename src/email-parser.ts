import type { TransactionEmail } from './gmail.js';

export interface LineItem {
  description: string;
  amount: number;
}

export interface ParsedReceipt {
  source: 'afterpay' | 'applepay' | 'paypal';
  merchant: string;
  lineItems: LineItem[];
  totalAmount: number | null;
}

type Parser = (email: TransactionEmail) => ParsedReceipt | null;

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,$\s]/g, '').replace(/[A-Z]{3}/gi, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDollarAmount(text: string): number | null {
  const match = text.match(/\$\s*([0-9]+(?:[.,][0-9]{2})?)/);
  return match ? parseAmount(match[1]) : null;
}

export function parseAfterpay(email: TransactionEmail): ParsedReceipt | null {
  if (!/afterpay/i.test(email.from)) return null;
  const body = normalizeWhitespace(email.bodyText);

  const TRAILING_CLAUSE = /\s+(?:is|has|have|was|were|will|has been)\s+(?:confirmed|shipped|delivered|processing|complete|approved|pending|ready|received|placed|coming|on\s+its\s+way).*$/i;

  let merchant = '';
  const merchantMatch =
    body.match(/Merchant name\s*\n\s*([A-Z0-9][^\n.!?]{0,60})/i) ||
    body.match(/(?:order|purchase)\s+(?:from|at|with)\s+([A-Z0-9][^\n.!?]{0,60})/i) ||
    email.subject.match(/(?:order|purchase|receipt)\s+(?:from|at|with)\s+([A-Z0-9][^\n.!?]{0,60})/i);
  if (merchantMatch) merchant = merchantMatch[1].trim().replace(TRAILING_CLAUSE, '').trim();

  const lineItems: LineItem[] = [];
  const lineRegex = /^(?<desc>[A-Za-z0-9][A-Za-z0-9 &.\-'/]{1,80}?)\s+(?:x\s*\d+\s+)?\$\s*(?<amt>[0-9]+(?:[.,][0-9]{2})?)\s*$/gim;
  for (const match of body.matchAll(lineRegex)) {
    const desc = match.groups?.desc?.trim();
    const amt = match.groups?.amt ? parseAmount(match.groups.amt) : null;
    if (!desc || amt == null) continue;
    if (/^(subtotal|total|tax|shipping|discount|gst|order)\b/i.test(desc)) continue;
    lineItems.push({ description: desc, amount: amt });
  }

  let totalAmount: number | null = null;
  const totalMatch =
    body.match(/Amount paid\s*\n\s*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i) ||
    body.match(/(?:order\s+)?total[^\n$]*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i) ||
    body.match(/amount\s+charged[^\n$]*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i);
  if (totalMatch) totalAmount = parseAmount(totalMatch[1]);

  if (!merchant && lineItems.length === 0 && totalAmount == null) return null;

  return {
    source: 'afterpay',
    merchant: merchant || 'Unknown',
    lineItems,
    totalAmount,
  };
}

export function parseApplePay(email: TransactionEmail): ParsedReceipt | null {
  const isApple = /apple\.com|apple\s*receipt|no_reply@email\.apple\.com/i.test(email.from) ||
    /your\s+receipt\s+from\s+apple/i.test(email.subject);
  if (!isApple) return null;
  const body = normalizeWhitespace(email.bodyText);

  const lineItems: LineItem[] = [];
  const appItemRegex = /^(?<desc>[A-Za-z0-9][A-Za-z0-9 &.\-+'/()]{1,80}?)\s+(?:In-App\s+Purchase|App|Subscription|Monthly|Annual)?\s*\$\s*(?<amt>[0-9]+(?:[.,][0-9]{2})?)\s*$/gim;
  for (const match of body.matchAll(appItemRegex)) {
    const desc = match.groups?.desc?.trim();
    const amt = match.groups?.amt ? parseAmount(match.groups.amt) : null;
    if (!desc || amt == null) continue;
    if (/^(subtotal|total|tax|order\s+id|document\s+no)/i.test(desc)) continue;
    lineItems.push({ description: desc, amount: amt });
  }

  let totalAmount: number | null = null;
  const totalMatch = body.match(/order\s+total[^\n$]*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i) ||
    body.match(/total[^\n$]*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i);
  if (totalMatch) totalAmount = parseAmount(totalMatch[1]);

  if (lineItems.length === 0 && totalAmount == null) return null;

  return {
    source: 'applepay',
    merchant: 'Apple',
    lineItems,
    totalAmount,
  };
}

export function parsePaypal(email: TransactionEmail): ParsedReceipt | null {
  if (!/paypal/i.test(email.from)) return null;
  const body = normalizeWhitespace(email.bodyText);

  let merchant = '';
  const merchantMatch =
    body.match(/(?:sent\s+(?:a\s+)?payment\s+(?:of\s+[^\n]+?\s+)?to|you\s+paid)\s+([A-Z0-9][A-Za-z0-9 &.\-'*]{1,60})/i) ||
    email.subject.match(/receipt\s+for\s+your\s+payment\s+to\s+([A-Z0-9][A-Za-z0-9 &.\-'*]{1,60})/i) ||
    email.subject.match(/you\s+paid\s+[^\s]+\s+to\s+([A-Z0-9][A-Za-z0-9 &.\-'*]{1,60})/i);
  if (merchantMatch) merchant = merchantMatch[1].trim().replace(/[*.]+$/, '');

  const lineItems: LineItem[] = [];
  const lineRegex = /^(?<desc>[A-Za-z0-9][A-Za-z0-9 &.\-'/()]{1,80}?)\s+(?:qty\s*\d+\s+)?\$\s*(?<amt>[0-9]+(?:[.,][0-9]{2})?)\s*$/gim;
  for (const match of body.matchAll(lineRegex)) {
    const desc = match.groups?.desc?.trim();
    const amt = match.groups?.amt ? parseAmount(match.groups.amt) : null;
    if (!desc || amt == null) continue;
    if (/^(subtotal|total|tax|shipping|gst|amount|fee|payment)\b/i.test(desc)) continue;
    lineItems.push({ description: desc, amount: amt });
  }

  let totalAmount: number | null = null;
  const totalMatch =
    body.match(/total[^\n$]*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i) ||
    body.match(/amount[^\n$]*\$\s*([0-9]+(?:[.,][0-9]{2})?)/i);
  if (totalMatch) totalAmount = parseAmount(totalMatch[1]);
  if (totalAmount == null) totalAmount = parseDollarAmount(email.subject);

  if (!merchant && lineItems.length === 0 && totalAmount == null) return null;

  return {
    source: 'paypal',
    merchant: merchant || 'Unknown',
    lineItems,
    totalAmount,
  };
}

const PARSERS: Parser[] = [parseAfterpay, parseApplePay, parsePaypal];

export function parseReceipt(email: TransactionEmail): ParsedReceipt | null {
  for (const parser of PARSERS) {
    const result = parser(email);
    if (result) return result;
  }
  return null;
}
