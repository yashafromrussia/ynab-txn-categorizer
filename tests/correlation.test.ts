import { describe, it, expect, vi } from 'vitest';
import { CorrelationResolver } from '../src/correlation.js';
import { YnabClient, Transaction } from '../src/ynab.js';

describe('CorrelationResolver', () => {
    it('identifies ambiguous payees', () => {
        const resolver = new CorrelationResolver();
        expect(resolver.isAmbiguous('Apple.com/bill')).toBe(true);
        expect(resolver.isAmbiguous('Amazon marketplace')).toBe(true);
        expect(resolver.isAmbiguous('Walmart')).toBe(false);
    });

    it('allows configuring ambiguous payees externally', () => {
        const resolver = new CorrelationResolver();
        resolver.updateConfig({ ambiguousPayees: ['Walmart'] });
        expect(resolver.isAmbiguous('Walmart Supercenter')).toBe(true);
    });

    it('correlates with an exact historical match cross-account', async () => {
        const resolver = new CorrelationResolver();
        
        const mockTransaction: Transaction = {
            id: 't1',
            date: '2026-04-15',
            amount: -14990,
            account_id: 'a1',
            payee_name: 'Apple',
            memo: null, cleared: 'cleared', approved: false, flag_color: null, payee_id: null, category_id: null, transfer_account_id: null, transfer_transaction_id: null, matched_transaction_id: null, import_id: null, deleted: false, account_name: 'Checking', category_name: null
        };

        const mockHistory: Transaction[] = [
            {
                ...mockTransaction,
                id: 't2',
                date: '2026-04-14',
                account_id: 'a2',
                category_id: 'Entertainment-ID',
            }
        ];

        const mockYnabClient = {
            getTransactionsByDateAndAmount: vi.fn().mockResolvedValue(mockHistory)
        } as unknown as YnabClient;

        const result = await resolver.correlate(mockTransaction, mockYnabClient);
        
        expect(result.categoryId).toBe('Entertainment-ID');
        expect(result.candidates.length).toBe(1);
    });

    it('returns null when multiple cross-account matches exist', async () => {
        const resolver = new CorrelationResolver();
        
        const mockTransaction: Transaction = {
            id: 't1',
            date: '2026-04-15',
            amount: -14990,
            account_id: 'a1',
            payee_name: 'Apple',
            memo: null, cleared: 'cleared', approved: false, flag_color: null, payee_id: null, category_id: null, transfer_account_id: null, transfer_transaction_id: null, matched_transaction_id: null, import_id: null, deleted: false, account_name: 'Checking', category_name: null
        };

        const mockHistory: Transaction[] = [
            { ...mockTransaction, id: 't2', account_id: 'a2', category_id: 'Entertainment-ID' },
            { ...mockTransaction, id: 't3', account_id: 'a3', category_id: 'Software-ID' }
        ];

        const mockYnabClient = {
            getTransactionsByDateAndAmount: vi.fn().mockResolvedValue(mockHistory)
        } as unknown as YnabClient;

        const result = await resolver.correlate(mockTransaction, mockYnabClient);
        
        expect(result.categoryId).toBeNull();
        expect(result.candidates.length).toBe(2);
    });

    it('falls back to exact amount match on the same account', async () => {
        const resolver = new CorrelationResolver({ requireCrossAccount: true });
        
        const mockTransaction: Transaction = {
            id: 't1',
            date: '2026-04-15',
            amount: -47220,
            account_id: 'a1',
            payee_name: 'Amazon',
            memo: null, cleared: 'cleared', approved: false, flag_color: null, payee_id: null, category_id: null, transfer_account_id: null, transfer_transaction_id: null, matched_transaction_id: null, import_id: null, deleted: false, account_name: 'Checking', category_name: null
        };

        const mockHistory: Transaction[] = [
            { ...mockTransaction, id: 't2', date: '2026-03-15', account_id: 'a1', category_id: 'Household-ID' }
        ];

        const mockYnabClient = {
            getTransactionsByDateAndAmount: vi.fn().mockResolvedValue(mockHistory)
        } as unknown as YnabClient;

        const result = await resolver.correlate(mockTransaction, mockYnabClient);
        
        expect(result.categoryId).toBe('Household-ID');
        expect(result.candidates.length).toBe(1);
        expect(result.reasoning).toContain('exact historical recurrence');
    });
});