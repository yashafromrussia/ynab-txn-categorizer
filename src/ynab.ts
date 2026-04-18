import axios, { AxiosInstance } from 'axios';

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

  async getTransactions(): Promise<Transaction[]> {
    const response = await this.client.get(`/budgets/${this.budgetId}/transactions`);
    return response.data.data.transactions;
  }

  async getUncategorizedTransactions(): Promise<Transaction[]> {
    const response = await this.client.get(`/budgets/${this.budgetId}/transactions`, {
      params: { type: 'unapproved' },
    });
    return response.data.data.transactions;
  }

  async getTransactionsByPayee(payeeId: string): Promise<Transaction[]> {
    const response = await this.client.get(`/budgets/${this.budgetId}/payees/${payeeId}/transactions`);
    return response.data.data.transactions;
  }

}
