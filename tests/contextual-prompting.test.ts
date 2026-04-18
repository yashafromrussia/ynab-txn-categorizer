import { describe, it, expect, vi } from 'vitest';
import { 
  evaluateStage1, 
  buildStage2Prompt, 
  buildStage3Prompt, 
  TransactionContext 
} from '../src/contextual-prompting.js';

describe('Contextual Prompting Pipeline', () => {
  const mockTx: TransactionContext = {
    payeeName: 'Afterpay',
    amount: 45.00,
    date: '2026-04-18',
    accountId: 'acc-123'
  };

  const mockCategories = [
    { id: 'cat-1', name: 'Dining' },
    { id: 'cat-2', name: 'Shopping' }
  ];

  describe('evaluateStage1', () => {
    it('should block auto-assignment for multi-merchant payees (e.g. Afterpay)', () => {
      const signals = evaluateStage1(mockTx, 10, 'cat-1');
      expect(signals.isMultiMerchantPayee).toBe(true);
      expect(signals.hasDeterministicMatch).toBe(false);
    });

    it('should allow deterministic match for non-multi-merchant payees', () => {
      const normalTx = { ...mockTx, payeeName: 'Local Coffee' };
      const signals = evaluateStage1(normalTx, 5, 'cat-1');
      expect(signals.isMultiMerchantPayee).toBe(false);
      expect(signals.hasDeterministicMatch).toBe(true);
      expect(signals.matchedCategoryId).toBe('cat-1');
    });
  });

  describe('buildStage2Prompt', () => {
    it('should synthesize transaction, signals, calendar, and merchant info', () => {
      const signals = {
        hasDeterministicMatch: false,
        matchedCategoryId: undefined,
        isMultiMerchantPayee: true,
        historyMatches: 10
      };
      const calendarEvents = ['Flight to NYC', 'Dinner with Client'];
      const merchantInfo = 'Web search: Afterpay is a BNPL service.';
      
      const prompt = buildStage2Prompt(mockTx, signals, mockCategories, calendarEvents, merchantInfo);
      
      expect(prompt).toContain('Payee: Afterpay');
      expect(prompt).toContain('Is Multi-Merchant Payee (e.g. Afterpay): true');
      expect(prompt).toContain('Flight to NYC');
      expect(prompt).toContain('Afterpay is a BNPL service');
      expect(prompt).toContain('cat-1');
    });
  });

  describe('buildStage3Prompt', () => {
    it('should generate a fallback reasoning prompt with stage-2 results', () => {
      const signals = {
        hasDeterministicMatch: false,
        matchedCategoryId: undefined,
        isMultiMerchantPayee: true,
        historyMatches: 10
      };
      const stage2Result = 'INCONCLUSIVE';
      
      const prompt = buildStage3Prompt(mockTx, signals, stage2Result, mockCategories);
      
      expect(prompt).toContain('senior financial analyst');
      expect(prompt).toContain('Stage-2 Result: INCONCLUSIVE');
      expect(prompt).toContain('recommendedCategoryId');
      expect(prompt).toContain('confidenceScore');
    });
  });
});
