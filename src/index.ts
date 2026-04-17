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
    console.log('Fetching uncategorized transactions...');
    const uncategorized = await client.getUncategorizedTransactions();
    console.log(`Found ${uncategorized.length} uncategorized transactions.`);
    
    // Just log the first 5 for now
    if (uncategorized.length > 0) {
      console.log('Latest uncategorized transactions:');
      console.table(uncategorized.slice(0, 5).map(t => ({
        date: t.date,
        payee: t.payee_name,
        category: t.category_name,
        amount: t.amount / 1000,
      })));

      const firstPayeeId = uncategorized[0].payee_id;
      if (firstPayeeId) {
        console.log(`\nFetching historical transactions for payee ${uncategorized[0].payee_name}...`);
        const historical = await client.getTransactionsByPayee(firstPayeeId);
        console.log(`Found ${historical.length} historical transactions for this payee.`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
