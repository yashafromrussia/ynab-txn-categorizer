import axios, { AxiosInstance } from 'axios';

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

export class YnabClient {
  private client: AxiosInstance;
  private budgetId: string;

  constructor(token: string, budgetId: string) {
    this.budgetId = budgetId;
    this.client = axios.create({
      baseURL: 'https://api.ynab.com/v1',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error('YNAB API Authentication failed. Please check your YNAB_ACCESS_TOKEN.');
        }
        return Promise.reject(error);
      }
    );
  }

  async getTransactions(sinceDate?: string): Promise<Transaction[]> {
    const params: any = {};
    if (sinceDate) {
        params.since_date = sinceDate;
    }
    const response = await this.client.get(`/budgets/${this.budgetId}/transactions`, { params });
    return response.data.data.transactions;
  }

  async getUnapprovedTransactions(sinceDate?: string): Promise<Transaction[]> {
    const params: any = { type: 'unapproved' };
    if (sinceDate) {
        params.since_date = sinceDate;
    }
    const response = await this.client.get(`/budgets/${this.budgetId}/transactions`, { params });
    return response.data.data.transactions;
  }

  async getTransactionsByPayee(payeeId: string): Promise<Transaction[]> {
    const response = await this.client.get(`/budgets/${this.budgetId}/payees/${payeeId}/transactions`);
    return response.data.data.transactions;
  }

  async getTransactionsByDateAndAmount(sinceDate: string, amountMilliunits: number, amountTolerance: number): Promise<Transaction[]> {
    const transactions = await this.getTransactions(sinceDate);
    const minAmount = Math.abs(amountMilliunits) - amountTolerance;
    const maxAmount = Math.abs(amountMilliunits) + amountTolerance;

    return transactions.filter(t => {
      if (!t.approved) return false;

      const absAmount = Math.abs(t.amount);
      return absAmount >= minAmount && absAmount <= maxAmount;
    });
  }

  async getCategories(): Promise<Category[]> {
    const response = await this.client.get(`/budgets/${this.budgetId}/categories`);
    const categoryGroups = response.data.data.category_groups;

    const categories: Category[] = [];
    for (const group of categoryGroups) {
      if (!group.hidden && !group.deleted) {
        for (const cat of group.categories) {
          if (!cat.hidden && !cat.deleted) {
            categories.push({
              id: cat.id,
              name: cat.name,
              category_group_id: cat.category_group_id
            });
          }
        }
      }
    }
    return categories;
  }
}
