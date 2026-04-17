import 'dotenv/config';
import { YnabClient } from './ynab.js';

async function main() {
  const token = process.env.YNAB_ACCESS_TOKEN;
  const budgetId = process.env.YNAB_BUDGET_ID;

  if (!token || !budgetId) {
    console.error('Missing YNAB_ACCESS_TOKEN or YNAB_BUDGET_ID in .env');
    process.exit(1);
  }

  const client = new YnabClient(token, budgetId);

  try {
    console.log('Fetching transactions...');
    const transactions = await client.getTransactions();
    console.log(`Found ${transactions.length} transactions.`);
    
    // Just log the first 5 for now
    console.log('Latest transactions:');
    console.table(transactions.slice(0, 5).map(t => ({
      date: t.date,
      payee: t.payee_name,
      category: t.category_name,
      amount: t.amount / 1000,
    })));

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
