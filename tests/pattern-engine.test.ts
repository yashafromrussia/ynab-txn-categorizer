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

    expect(engine.evaluate('Uber Eats')).toBe('food');
    expect(engine.evaluate('uber eats')).toBe('food');
    expect(engine.evaluate('Uber Eats SF')).toBeNull();
  });

  it('should match regex rules', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '2',
      type: 'regex',
      pattern: '^SQ \\*.*COFFEE',
      categoryId: 'coffee'
    });

    expect(engine.evaluate('SQ *MAIN ST COFFEE')).toBe('coffee');
    expect(engine.evaluate('sq *local coffee shop')).toBe('coffee');
    expect(engine.evaluate('Coffee beans')).toBeNull();
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

    expect(engine.evaluate('McDonalds')).toBe('fast-food');
    expect(engine.evaluate('MacDonalds')).toBe('fast-food');
    expect(engine.evaluate('McDonald')).toBe('fast-food');
    expect(engine.evaluate('Burger King')).toBeNull();
  });

  it('should match fuzzy rules using substring inclusion', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '4',
      type: 'fuzzy',
      pattern: 'Target',
      categoryId: 'groceries'
    });

    expect(engine.evaluate('TARGET STORE 1234')).toBe('groceries');
    expect(engine.evaluate('Target')).toBe('groceries');
    expect(engine.evaluate('Walmart')).toBeNull();
  });

  it('should return null when payee is null or undefined', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '5',
      type: 'exact',
      pattern: 'Test',
      categoryId: 'test'
    });

    expect(engine.evaluate(null)).toBeNull();
    expect(engine.evaluate(undefined)).toBeNull();
    expect(engine.evaluate('')).toBeNull();
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

    expect(engine.evaluate('Amazon')).toBe('shopping');
  });

  it('should handle invalid regex patterns gracefully', () => {
    const engine = new PatternEngine();
    engine.addRule({
      id: '8',
      type: 'regex',
      pattern: '[invalid-regex',
      categoryId: 'error'
    });

    expect(engine.evaluate('Anything')).toBeNull();
  });
});