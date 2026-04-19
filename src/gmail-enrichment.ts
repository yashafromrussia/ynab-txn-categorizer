import { generateText, type LanguageModel } from 'ai';
import type { GmailClient, TransactionEmail } from './gmail.js';
import { parseReceipt, type ParsedReceipt, type LineItem } from './email-parser.js';
import type { SubTransaction } from './ynab.js';

export interface GmailEnrichmentConfig {
  daysWindow: number;
  payees: string[];
  senders: string[];
  amountTolerance: number;
  maxMessagesPerTransaction: number;
}

export const DEFAULT_ENRICHMENT_CONFIG: GmailEnrichmentConfig = {
  daysWindow: 2,
  payees: ['afterpay', 'paypal', 'apple pay', 'apple.com/bill'],
  senders: ['noreply@afterpay.com', 'service@paypal.com', 'no_reply@email.apple.com'],
  amountTolerance: 500,
  maxMessagesPerTransaction: 10,
};

export interface GmailEnrichmentResult {
  emailId: string;
  receipt: ParsedReceipt;
  merchantContext: string;
  recommendedCategoryId?: string;
  subtransactions?: SubTransaction[];
  reasoning: string;
}

export function isPayeeGmailEligible(payeeName: string | null | undefined, payees: string[]): boolean {
  if (!payeeName) return false;
  const lower = payeeName.toLowerCase();
  return payees.some((p) => lower.includes(p.toLowerCase()));
}

function findBestReceiptMatch(
  emails: TransactionEmail[],
  transactionAmountMajor: number,
  amountToleranceMajor: number
): { email: TransactionEmail; receipt: ParsedReceipt } | null {
  const candidates: { email: TransactionEmail; receipt: ParsedReceipt; distance: number }[] = [];
  for (const email of emails) {
    const receipt = parseReceipt(email);
    if (!receipt) continue;
    if (receipt.totalAmount == null) {
      candidates.push({ email, receipt, distance: Number.POSITIVE_INFINITY });
      continue;
    }
    const distance = Math.abs(Math.abs(receipt.totalAmount) - Math.abs(transactionAmountMajor));
    if (distance <= amountToleranceMajor) {
      candidates.push({ email, receipt, distance });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return { email: candidates[0].email, receipt: candidates[0].receipt };
}

function buildMerchantContext(receipt: ParsedReceipt): string {
  const lines: string[] = [];
  lines.push(`Source: Gmail receipt from ${receipt.source}`);
  lines.push(`Merchant: ${receipt.merchant}`);
  if (receipt.totalAmount != null) {
    lines.push(`Total: $${receipt.totalAmount.toFixed(2)}`);
  }
  if (receipt.lineItems.length > 0) {
    lines.push('Line items:');
    for (const item of receipt.lineItems) {
      lines.push(`  - ${item.description} ($${item.amount.toFixed(2)})`);
    }
  }
  return lines.join('\n');
}

interface LineCategorization {
  categoryId: string | null;
  reasoning: string;
}

async function categorizeLineItem(
  model: LanguageModel,
  item: LineItem,
  merchant: string,
  categories: { id: string; name: string }[]
): Promise<LineCategorization> {
  const categoryList = categories.map((c) => `- ${c.name} (ID: ${c.id})`).join('\n');
  const prompt = `
You are a transaction categorization assistant.
Given one line item from a merchant receipt, pick the best YNAB category.

Merchant: ${merchant}
Line Item: ${item.description}
Amount: $${item.amount.toFixed(2)}

Available Categories:
${categoryList}

Respond ONLY with a JSON object:
{
  "categoryId": "category-id or null if unsure",
  "reasoning": "Short justification"
}
`;

  try {
    const { text } = await generateText({
      model,
      system: 'You are a helpful financial assistant. Output ONLY a valid JSON object matching the requested schema. No markdown, no extra text.',
      prompt,
      temperature: 0.1,
    });
    const parsed = JSON.parse(text.trim());
    const categoryId = typeof parsed.categoryId === 'string' ? parsed.categoryId : null;
    const valid = categoryId && categories.some((c) => c.id === categoryId);
    return {
      categoryId: valid ? categoryId : null,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch (err) {
    return { categoryId: null, reasoning: `LLM error: ${String(err)}` };
  }
}

function toMilliunits(amountMajor: number): number {
  return Math.round(amountMajor * 1000);
}

export interface EnrichTransactionParams {
  transactionId: string;
  payeeName: string | null | undefined;
  dateStr: string;
  amountMilliunits: number;
  gmailClient: GmailClient;
  config: GmailEnrichmentConfig;
  categories: { id: string; name: string }[];
  aiModel?: LanguageModel;
}

export async function enrichTransactionWithGmail(
  params: EnrichTransactionParams
): Promise<GmailEnrichmentResult | null> {
  const { payeeName, dateStr, amountMilliunits, gmailClient, config, categories, aiModel } = params;

  if (!isPayeeGmailEligible(payeeName, config.payees)) return null;

  let emails: TransactionEmail[];
  try {
    emails = await gmailClient.getEmailsAroundDate(
      dateStr,
      config.daysWindow,
      config.senders,
      config.maxMessagesPerTransaction
    );
  } catch (err) {
    console.error('[Gmail Enrichment] Fetch failed:', err);
    return null;
  }
  if (emails.length === 0) return null;

  const amountMajor = amountMilliunits / 1000;
  const toleranceMajor = config.amountTolerance / 1000;
  const match = findBestReceiptMatch(emails, amountMajor, toleranceMajor);
  if (!match) return null;

  const { email, receipt } = match;
  const merchantContext = buildMerchantContext(receipt);

  if (receipt.lineItems.length <= 1 || !aiModel) {
    return {
      emailId: email.id,
      receipt,
      merchantContext,
      reasoning:
        receipt.lineItems.length === 0
          ? `Matched Gmail receipt from ${receipt.source} (merchant: ${receipt.merchant}) - no line items extracted.`
          : `Matched Gmail receipt from ${receipt.source} (merchant: ${receipt.merchant}).`,
    };
  }

  const categorized: { item: LineItem; categoryId: string | null; reasoning: string }[] = [];
  for (const item of receipt.lineItems) {
    const c = await categorizeLineItem(aiModel, item, receipt.merchant, categories);
    categorized.push({ item, ...c });
  }

  const distinctCategories = new Set(
    categorized.filter((c) => c.categoryId).map((c) => c.categoryId as string)
  );

  if (distinctCategories.size <= 1) {
    const single = categorized.find((c) => c.categoryId)?.categoryId ?? undefined;
    return {
      emailId: email.id,
      receipt,
      merchantContext,
      recommendedCategoryId: single,
      reasoning: `All line items mapped to a single category based on Gmail receipt from ${receipt.source}.`,
    };
  }

  const subtransactions: SubTransaction[] = categorized
    .filter((c) => c.categoryId)
    .map((c, idx) => ({
      id: `gmail-split-${email.id}-${idx}`,
      transaction_id: params.transactionId,
      amount: -toMilliunits(c.item.amount),
      memo: c.item.description,
      payee_id: null,
      payee_name: receipt.merchant,
      category_id: c.categoryId,
      category_name: null,
      transfer_account_id: null,
      transfer_transaction_id: null,
      deleted: false,
    }));

  return {
    emailId: email.id,
    receipt,
    merchantContext,
    subtransactions,
    reasoning: `Detected ${distinctCategories.size} distinct categories across ${receipt.lineItems.length} line items on Gmail receipt from ${receipt.source}.`,
  };
}
