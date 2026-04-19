import { generateText } from 'ai';

export interface TransactionContext {
  payeeName: string;
  amount: number;
  date: string;
  accountId?: string;
}

export interface Stage1Signals {
  hasDeterministicMatch: boolean;
  matchedCategoryId?: string;
  isMultiMerchantPayee: boolean;
  historyMatches: number;
}

/**
 * Stage 1: Deterministic mapping with payee gating and history-based signals.
 * Blocks auto-assignment for multi-merchant payees (e.g., Afterpay) unless overridable.
 */
export function evaluateStage1(
  tx: TransactionContext,
  historicalCount: number,
  patternMatchCategory?: string
): Stage1Signals {
  const multiMerchantPayees = ['afterpay', 'paypal', 'klarna', 'affirm', 'zip'];
  const isMultiMerchant = multiMerchantPayees.some(p => tx.payeeName.toLowerCase().includes(p));
  const hasDeterministicMatch = !!patternMatchCategory && !isMultiMerchant;

  return {
    hasDeterministicMatch,
    matchedCategoryId: hasDeterministicMatch ? patternMatchCategory : undefined,
    isMultiMerchantPayee: isMultiMerchant,
    historyMatches: historicalCount
  };
}

/**
 * Stage 2: Prompt constructed from Stage-1 outputs + full category list.
 * Executed sequentially (no batching).
 */
export function buildStage2Prompt(
  tx: TransactionContext,
  stage1: Stage1Signals,
  categories: { id: string; name: string }[],
  calendarEvents: string[],
  merchantInfo: string
): string {
  const categoryList = categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
  const calendarContext = calendarEvents.length > 0 ? `Recent Calendar Events:\n${calendarEvents.join('\n')}` : 'No recent calendar events.';
  const merchantContext = merchantInfo ? `Merchant Info from Web:\n${merchantInfo}` : 'No additional merchant info.';

  return `
You are a financial categorization assistant.
Analyze the following transaction to assign the most accurate category.

Transaction Details:
- Payee: ${tx.payeeName}
- Amount: ${tx.amount}
- Date: ${tx.date}
- Account ID: ${tx.accountId || 'Unknown'}

Stage-1 Signals:
- Is Multi-Merchant Payee (e.g. Afterpay): ${stage1.isMultiMerchantPayee}
- Historical Transactions with this Payee: ${stage1.historyMatches}
- Account Heuristics Applied: None yet

Context:
${calendarContext}

${merchantContext}

Available Categories:
${categoryList}

Task:
Determine the most appropriate Category ID for this transaction.
Respond ONLY with a JSON object in the exact format below. Do not include markdown formatting or any extra text.
{
  "recommendedCategoryId": "category-id or null if inconclusive",
  "confidenceScore": 0.0 to 0.99,
  "reasoning": "Brief explanation of how the context leads to this category"
}
`;
}

/**
 * Stage 3: Fallback reasoning prompt for unresolved Stage-1 items.
 * Produces a documented rationale and explicit confidence for human review.
 */
export function buildStage3Prompt(
  tx: TransactionContext,
  stage1: Stage1Signals,
  stage2Result: string,
  categories: { id: string; name: string }[]
): string {
  const categoryList = categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
  
  return `
You are a senior financial analyst.
A transaction could not be confidently categorized in the standard automated pipeline.

Transaction Details:
- Payee: ${tx.payeeName}
- Amount: ${tx.amount}
- Date: ${tx.date}

Stage-1 Signal: Multi-Merchant Payee? ${stage1.isMultiMerchantPayee}
Stage-2 Result: ${stage2Result}

Available Categories:
${categoryList}

Please analyze this transaction and provide a final recommendation.
Respond ONLY with a JSON object in the exact format below. Do not include markdown formatting or any extra text.
{
  "recommendedCategoryId": "category-id or null",
  "confidenceScore": 0.0 to 0.79,
  "reasoning": "Step-by-step rationale for this recommendation",
  "requiresHumanReview": true
}
`;
}
