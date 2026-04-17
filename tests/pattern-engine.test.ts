import { describe, it, expect } from 'vitest';
import { PatternEngine, PatternRule } from '../src/pattern-engine.js';

describe('PatternEngine', () => {
  it('should match exact rules', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '1',
      type: 'exact',
      pattern: 'Uber Eats',
      categoryId: 'food'
    });

    expect(engine.evaluate({ payeeName: 'Uber Eats' })).toBe('food');
    expect(engine.evaluate({ payeeName: 'uber eats' })).toBe('food');
    expect(engine.evaluate({ payeeName: 'Uber Eats SF' })).toBeNull();
  });

  it('should match regex rules', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '2',
      type: 'regex',
      pattern: '^SQ \\*.*COFFEE',
      categoryId: 'coffee'
    });

    expect(engine.evaluate({ payeeName: 'SQ *MAIN ST COFFEE' })).toBe('coffee');
    expect(engine.evaluate({ payeeName: 'sq *local coffee shop' })).toBe('coffee');
    expect(engine.evaluate({ payeeName: 'Coffee beans' })).toBeNull();
  });

  it('should match fuzzy rules using levenshtein distance', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '3',
      type: 'fuzzy',
      pattern: 'McDonalds',
      categoryId: 'fast-food',
      maxDistance: 2
    });

    expect(engine.evaluate({ payeeName: 'McDonalds' })).toBe('fast-food');
    expect(engine.evaluate({ payeeName: 'MacDonalds' })).toBe('fast-food');
    expect(engine.evaluate({ payeeName: 'McDonald' })).toBe('fast-food');
    expect(engine.evaluate({ payeeName: 'Burger King' })).toBeNull();
  });

  it('should match fuzzy rules using substring inclusion', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '4',
      type: 'fuzzy',
      pattern: 'Target',
      categoryId: 'groceries'
    });

    expect(engine.evaluate({ payeeName: 'TARGET STORE 1234' })).toBe('groceries');
    expect(engine.evaluate({ payeeName: 'Target' })).toBe('groceries');
    expect(engine.evaluate({ payeeName: 'Walmart' })).toBeNull();
  });

  it('should return null when payee is null or undefined', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '5',
      type: 'exact',
      pattern: 'Test',
      categoryId: 'test'
    });

    expect(engine.evaluate({ payeeName: null })).toBeNull();
    expect(engine.evaluate({ payeeName: undefined })).toBeNull();
    expect(engine.evaluate({ payeeName: '' })).toBeNull();
  });

  it('should return the first matching rule', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '6',
      type: 'exact',
      pattern: 'Amazon',
      categoryId: 'shopping'
    });
    engine.addRule({
      id: '7',
      type: 'fuzzy',
      pattern: 'Amazon',
      categoryId: 'everything'
    });

    expect(engine.evaluate({ payeeName: 'Amazon' })).toBe('shopping');
  });

  it('should handle invalid regex patterns gracefully', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '8',
      type: 'regex',
      pattern: '[invalid-regex',
      categoryId: 'error'
    });

    expect(engine.evaluate({ payeeName: 'Anything' })).toBeNull();
  });

  it('should prioritize rules matching the accountId', () => {
    const engine = new PatternEngine();
    
    engine.addRule({
      id: 'generic',
      type: 'fuzzy',
      pattern: 'Target',
      categoryId: 'shopping'
    });
    
    engine.addRule({
      id: 'specific',
      type: 'exact',
      pattern: 'Target',
      categoryId: 'groceries',
      accountId: 'account-123'
    });

    expect(engine.evaluate({ payeeName: 'Target' })).toBe('shopping');
    expect(engine.evaluate({ payeeName: 'Target', accountId: 'account-123' })).toBe('groceries');
  });

  it('should completely ignore account-specific rules if the accountId does not match', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: 'specific-only',
      type: 'exact',
      pattern: 'Netflix',
      categoryId: 'subscriptions',
      accountId: 'account-456'
    });

    expect(engine.evaluate({ payeeName: 'Netflix' })).toBeNull();
    expect(engine.evaluate({ payeeName: 'Netflix', accountId: 'account-999' })).toBeNull();
    expect(engine.evaluate({ payeeName: 'Netflix', accountId: 'account-456' })).toBe('subscriptions');
  });
});