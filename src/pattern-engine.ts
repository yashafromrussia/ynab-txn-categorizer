import * as levenshtein from 'fast-levenshtein';

export type RuleType = 'exact' | 'regex' | 'fuzzy';

export interface PatternRule {
  id: string;
  type: RuleType;
  pattern: string;
  categoryId: string;
  maxDistance?: number;
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

  evaluate(payeeName: string | null | undefined): string | null {
    if (!payeeName) return null;

    for (const rule of this.rules) {
      if (this.isMatch(payeeName, rule)) {
        return rule.categoryId;
      }
    }

    return null;
  }

  private isMatch(payeeName: string, rule: PatternRule): boolean {
    switch (rule.type) {
      case 'exact':
        return payeeName.toLowerCase() === rule.pattern.toLowerCase();
      
      case 'regex': {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          return regex.test(payeeName);
        } catch (e) {
          console.error(`Invalid regex pattern: ${rule.pattern}`, e);
          return false;
        }
      }
      
      case 'fuzzy': {
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
      
      default:
        return false;
    }
  }
}
