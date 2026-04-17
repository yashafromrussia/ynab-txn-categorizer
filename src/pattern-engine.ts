import * as levenshtein from 'fast-levenshtein';
import { CalendarEvent } from './calendar.js';

export type RuleType = 'exact' | 'regex' | 'fuzzy' | 'temporal';

export interface PatternRule {
  id: string;
  type: RuleType;
  pattern: string;
  categoryId: string;
  maxDistance?: number;
  accountId?: string;
}

export interface EvaluationContext {
  payeeName: string | null | undefined;
  date?: string;
  calendarEvents?: CalendarEvent[];
  accountId?: string;
}

export class PatternEngine {
  private rules: PatternRule[] = [];

  constructor(rules: PatternRule[] = []) {
    this.rules = rules;
  }

  addRule(rule: PatternRule) {
    this.rules.push(rule);
  }

  setRules(rules: PatternRule[]) {
    this.rules = rules;
  }

  evaluate(context: EvaluationContext): string | null {
    let bestMatch: { categoryId: string; score: number } | null = null;

    for (const rule of this.rules) {
      if (this.isMatch(context, rule)) {
        const score = this.calculateScore(context, rule);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { categoryId: rule.categoryId, score };
        }
      }
    }

    return bestMatch ? bestMatch.categoryId : null;
  }

  private calculateScore(context: EvaluationContext, rule: PatternRule): number {
    let score = 0;

    switch (rule.type) {
      case 'exact': score += 50; break;
      case 'temporal': score += 40; break;
      case 'regex': score += 30; break;
      case 'fuzzy': score += 20; break;
    }

    if (rule.accountId && rule.accountId === context.accountId) {
      score += 100;
    }

    return score;
  }

  private isMatch(context: EvaluationContext, rule: PatternRule): boolean {
    if (rule.accountId && rule.accountId !== context.accountId) {
      return false;
    }

    const payeeName = context.payeeName || '';

    switch (rule.type) {
      case 'exact':
        if (!payeeName) return false;
        return payeeName.toLowerCase() === rule.pattern.toLowerCase();
      
      case 'regex': {
        if (!payeeName) return false;
        try {
          const regex = new RegExp(rule.pattern, 'i');
          return regex.test(payeeName);
        } catch (e) {
          console.error(`Invalid regex pattern: ${rule.pattern}`, e);
          return false;
        }
      }
      
      case 'fuzzy': {
        if (!payeeName) return false;
        const maxDist = rule.maxDistance ?? 3;
        
        const dist = levenshtein.get(payeeName.toLowerCase(), rule.pattern.toLowerCase());
        if (dist <= maxDist) return true;

        const lowerPayee = payeeName.toLowerCase();
        const lowerPattern = rule.pattern.toLowerCase();
        
        if (lowerPayee.includes(lowerPattern)) {
            return true;
        }

        return false;
      }
      
      case 'temporal': {
        if (!context.calendarEvents || context.calendarEvents.length === 0) {
          return false;
        }
        
        const lowerPattern = rule.pattern.toLowerCase();
        for (const event of context.calendarEvents) {
          const lowerSummary = event.summary.toLowerCase();
          const lowerDesc = event.description?.toLowerCase() || '';
          
          if (lowerSummary.includes(lowerPattern) || lowerDesc.includes(lowerPattern)) {
            return true;
          }
        }
        return false;
      }

      default:
        return false;
    }
  }
}
