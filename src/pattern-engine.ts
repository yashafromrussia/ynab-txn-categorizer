import * as levenshtein from 'fast-levenshtein';
import { CalendarEvent } from './calendar.js';

export type RuleType = 'exact' | 'regex' | 'fuzzy' | 'temporal';

export interface PatternRule {
  id: string;
  type: RuleType;
  pattern: string;
  categoryId: string;
  maxDistance?: number;
}

export interface EvaluationContext {
  payeeName: string | null | undefined;
  date?: string;
  calendarEvents?: CalendarEvent[];
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
    for (const rule of this.rules) {
      if (this.isMatch(context, rule)) {
        return rule.categoryId;
      }
    }

    return null;
  }

  private isMatch(context: EvaluationContext, rule: PatternRule): boolean {
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
