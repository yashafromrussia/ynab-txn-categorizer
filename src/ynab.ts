import axios from 'axios';

export class YnabClient {
  private baseUrl = 'https://api.ynab.com/v1';

  constructor(private token: string, private budgetId: string) {}

  async getTransactions() {
    const response = await axios.get(`${this.baseUrl}/budgets/${this.budgetId}/transactions`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response.data.data.transactions;
  }
}
