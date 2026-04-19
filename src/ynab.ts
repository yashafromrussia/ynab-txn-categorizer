import * as ynab from 'ynab';

export interface SubTransaction {
  id: string;
  transaction_id: string;
  amount: number;
  memo: string | null;
  payee_id: string | null;
  payee_name: string | null;
  category_id: string | null;
  category_name: string | null;
  transfer_account_id: string | null;
  transfer_transaction_id: string | null;
  deleted: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  cleared: string;
  approved: boolean;
  flag_color: string | null;
  account_id: string;
  payee_id: string | null;
  category_id: string | null;
  transfer_account_id: string | null;
  transfer_transaction_id: string | null;
  matched_transaction_id: string | null;
  import_id: string | null;
  deleted: boolean;
  account_name: string;
  payee_name: string | null;
  category_name: string | null;
  subtransactions?: SubTransaction[];
}

export interface Category {
  id: string;
  name: string;
  category_group_id: string;
}

function nullish<T>(v: T | null | undefined): T | null {
  return v == null ? null : v;
}

function normalizeSubTransaction(s: ynab.SubTransaction): SubTransaction {
  return {
    id: s.id,
    transaction_id: s.transaction_id,
    amount: s.amount,
    memo: nullish(s.memo),
    payee_id: nullish(s.payee_id),
    payee_name: nullish(s.payee_name),
    category_id: nullish(s.category_id),
    category_name: nullish(s.category_name),
    transfer_account_id: nullish(s.transfer_account_id),
    transfer_transaction_id: nullish(s.transfer_transaction_id),
    deleted: s.deleted,
  };
}

// TransactionDetail and HybridTransaction share the same fields we consume.
// HybridTransaction adds `parent_transaction_id` which we ignore.
type SdkTransactionLike = ynab.TransactionDetail | ynab.HybridTransaction;

function normalizeTransaction(t: SdkTransactionLike): Transaction {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    memo: nullish(t.memo),
    cleared: t.cleared as unknown as string,
    approved: t.approved,
    flag_color: t.flag_color == null ? null : (t.flag_color as unknown as string),
    account_id: t.account_id,
    payee_id: nullish(t.payee_id),
    category_id: nullish(t.category_id),
    transfer_account_id: nullish(t.transfer_account_id),
    transfer_transaction_id: nullish(t.transfer_transaction_id),
    matched_transaction_id: nullish(t.matched_transaction_id),
    import_id: nullish(t.import_id),
    deleted: t.deleted,
    account_name: t.account_name,
    payee_name: nullish(t.payee_name),
    category_name: nullish(t.category_name),
    subtransactions:
      'subtransactions' in t && Array.isArray(t.subtransactions)
        ? t.subtransactions.map(normalizeSubTransaction)
        : undefined,
  };
}

function handleSdkError(err: unknown): never {
  // SDK throws errors shaped like `{ error: { id: "401", name, detail } }`.
  const maybe = err as { error?: { id?: string; name?: string; detail?: string } } | undefined;
  if (maybe?.error?.id === '401') {
    console.error('YNAB API Authentication failed. Please check your YNAB_ACCESS_TOKEN.');
  }
  throw err;
}

export class YnabClient {
  private api: ynab.API;
  private budgetId: string;

  constructor(token: string, budgetId: string) {
    this.budgetId = budgetId;
    this.api = new ynab.API(token);
  }

  async getTransactions(sinceDate?: string): Promise<Transaction[]> {
    try {
      const response = await this.api.transactions.getTransactions(this.budgetId, sinceDate);
      return response.data.transactions.map(normalizeTransaction);
    } catch (err) {
      handleSdkError(err);
    }
  }

  async getUnapprovedTransactions(sinceDate?: string): Promise<Transaction[]> {
    try {
      const response = await this.api.transactions.getTransactions(
        this.budgetId,
        sinceDate,
        'unapproved'
      );
      return response.data.transactions.map(normalizeTransaction);
    } catch (err) {
      handleSdkError(err);
    }
  }

  async getTransactionsByPayee(payeeId: string): Promise<Transaction[]> {
    try {
      const response = await this.api.transactions.getTransactionsByPayee(this.budgetId, payeeId);
      return response.data.transactions.map(normalizeTransaction);
    } catch (err) {
      handleSdkError(err);
    }
  }

  async getTransactionsByDateAndAmount(
    sinceDate: string,
    amountMilliunits: number,
    amountTolerance: number
  ): Promise<Transaction[]> {
    const transactions = await this.getTransactions(sinceDate);
    const minAmount = Math.abs(amountMilliunits) - amountTolerance;
    const maxAmount = Math.abs(amountMilliunits) + amountTolerance;

    return transactions.filter((t) => {
      if (!t.approved) return false;

      const absAmount = Math.abs(t.amount);
      return absAmount >= minAmount && absAmount <= maxAmount;
    });
  }

  async getCategories(): Promise<Category[]> {
    try {
      const response = await this.api.categories.getCategories(this.budgetId);
      const categoryGroups = response.data.category_groups;

      const categories: Category[] = [];
      for (const group of categoryGroups) {
        if (!group.hidden && !group.deleted) {
          for (const cat of group.categories) {
            if (!cat.hidden && !cat.deleted) {
              categories.push({
                id: cat.id,
                name: cat.name,
                category_group_id: cat.category_group_id,
              });
            }
          }
        }
      }
      return categories;
    } catch (err) {
      handleSdkError(err);
    }
  }
}
