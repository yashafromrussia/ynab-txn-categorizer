import { appendFile } from 'fs/promises';
import { join } from 'path';
import { SubTransaction } from './ynab.js';

export type ConfidenceTier = 'Auto' | 'Suggest' | 'Review' | 'Escalate';

export interface CategorizationTrace {
  transaction_id: string;
  payee_name: string;
  assigned_category_id: string | null;
  subtransactions?: SubTransaction[];
  confidence_score: number;
  tier: ConfidenceTier;
  stage_resolved: 1 | 2 | 3 | null;
  signals_used: {
    deterministic_rule_id: string | null;
    calendar_event_id: string | null;
    search_identity_resolved: boolean;
    account_heuristic_applied: boolean;
    gmail_enrichment_applied?: boolean;
    gmail_email_id?: string | null;
  };
  llm_reasoning: string | null;
  timestamp: string;
}

export interface ConfidenceEvaluation {
  tier: ConfidenceTier;
  score: number;
}

export function evaluateConfidence(
  score: number,
  stage: 1 | 2 | 3
): ConfidenceEvaluation {
  let adjustedScore = score;
  
  if (stage === 1) {
    adjustedScore = Math.min(adjustedScore, 1.0);
  } else if (stage === 2) {
    adjustedScore = Math.min(adjustedScore, 0.99);
  } else if (stage === 3) {
    adjustedScore = Math.min(adjustedScore, 0.79);
  }

  if (adjustedScore >= 0.95) {
    return { tier: 'Auto', score: adjustedScore };
  } else if (adjustedScore >= 0.80) {
    return { tier: 'Suggest', score: adjustedScore };
  } else if (adjustedScore >= 0.50) {
    return { tier: 'Review', score: adjustedScore };
  } else {
    return { tier: 'Escalate', score: adjustedScore };
  }
}

export async function saveTrace(trace: CategorizationTrace, logDir: string = process.cwd()): Promise<void> {
  const filePath = join(logDir, 'categorization-traces.jsonl');
  const line = JSON.stringify(trace) + '\n';
  await appendFile(filePath, line, 'utf-8');
}
