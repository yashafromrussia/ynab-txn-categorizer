import { Transaction, YnabClient, SubTransaction } from './ynab.js';

export interface CorrelationConfig {
    ambiguousPayees: string[];
    amountTolerance: number;
    dateWindowDays: number;
    requireCrossAccount: boolean;
    minConfidence: number;
}

export class CorrelationResolver {
    private config: CorrelationConfig;

    constructor(config?: Partial<CorrelationConfig>) {
        this.config = {
            ambiguousPayees: ['Apple', 'Amazon', 'PayPal', 'Stripe', 'Google', 'Square'],
            amountTolerance: 500,
            dateWindowDays: 30,
            requireCrossAccount: true,
            minConfidence: 0.8,
            ...config
        };
    }

    updateConfig(newConfig: Partial<CorrelationConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    isAmbiguous(payeeName: string | null): boolean {
        if (!payeeName) return false;
        return this.config.ambiguousPayees.some(
            (ambiguous) => payeeName.toLowerCase().includes(ambiguous.toLowerCase())
        );
    }

    getAmbiguousPayees() {
        return this.config.ambiguousPayees;
    }

    async correlate(
        transaction: Transaction,
        ynabClient: YnabClient
    ): Promise<{ categoryId: string | null; subtransactions?: SubTransaction[]; candidates: Transaction[]; reasoning: string }> {
        const txDate = new Date(transaction.date);
        txDate.setDate(txDate.getDate() - this.config.dateWindowDays);
        const sinceDate = txDate.toISOString().split('T')[0];

        const history = await ynabClient.getTransactionsByDateAndAmount(
            sinceDate,
            transaction.amount,
            this.config.amountTolerance
        );

        const candidates = history.filter(h => {
            if (h.id === transaction.id) return false;

            // Allow matching if there's a category OR it's a split transaction containing subtransactions
            if (!h.category_id && !(h.subtransactions && h.subtransactions.length > 0)) return false;

            const hDate = new Date(h.date);
            const tDate = new Date(transaction.date);
            const diffDays = Math.abs((hDate.getTime() - tDate.getTime()) / (1000 * 3600 * 24));

            if (diffDays > this.config.dateWindowDays) return false;

            if (this.config.requireCrossAccount && h.account_id === transaction.account_id) {
                return false;
            }

            return true;
        });

        if (candidates.length === 1) {
            let categoryToAssign = candidates[0].category_id;
            let subtransactions = candidates[0].subtransactions;

            if (candidates[0].category_name === 'Split') {
                categoryToAssign = null;
            }

            return {
                categoryId: categoryToAssign,
                subtransactions: subtransactions && subtransactions.length > 0 ? subtransactions : undefined,
                candidates,
                reasoning: `Found strong cross-account correlation with transaction ${candidates[0].id} (Payee: ${candidates[0].payee_name}) on ${candidates[0].date}`
            };
        } else if (candidates.length > 1) {
            return {
                categoryId: null,
                candidates,
                reasoning: `Found multiple correlation candidates (${candidates.length}). Too ambiguous.`
            };
        } else if (this.config.requireCrossAccount) {
            const sameAccountHistory = history.filter(h =>
                h.id !== transaction.id &&
                (h.category_id || (h.subtransactions && h.subtransactions.length > 0)) &&
                h.account_id === transaction.account_id &&
                Math.abs(h.amount) === Math.abs(transaction.amount)
            );

            if (sameAccountHistory.length > 0) {
                const categoryCounts = sameAccountHistory.reduce((acc, h) => {
                    const catId = h.category_id || (h.subtransactions && h.subtransactions.length > 0 ? h.subtransactions[0].category_id : null);
                    if (catId) {
                        acc[catId] = (acc[catId] || 0) + 1;
                    }
                    return acc;
                }, {} as Record<string, number>);

                let bestCategory = null;
                let bestSubtransactions = null;
                let maxCount = 0;
                for (const [cat, count] of Object.entries(categoryCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        bestCategory = cat;
                        const sourceTx = sameAccountHistory.find(h =>
                            h.category_id === cat ||
                            (h.subtransactions && h.subtransactions.length > 0 && h.subtransactions[0].category_id === cat)
                        );
                        if (sourceTx && sourceTx.category_name === 'Split') {
                             bestSubtransactions = sourceTx.subtransactions;
                             bestCategory = null;
                        } else {
                             bestSubtransactions = null;
                        }
                    }
                }

                if (bestCategory || bestSubtransactions) {
                    return {
                        categoryId: bestCategory,
                        subtransactions: bestSubtransactions ? bestSubtransactions : undefined,
                        candidates: sameAccountHistory,
                        reasoning: `No cross-account match, but found exact historical recurrence on same account.`
                    };
                }
            }
        }

        return {
            categoryId: null,
            candidates: [],
            reasoning: `No correlation found within window.`
        };
    }
}
