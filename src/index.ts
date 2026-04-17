import 'dotenv/config';
import { YnabClient } from './ynab.js';
import { CalendarClient } from './calendar.js';
import { PatternEngine } from './pattern-engine.js';
import { CalendarEvent } from "./calendar.js";
import { IdentityResolver } from './identity.js';

async function main() {
  const token = process.env.YNAB_ACCESS_TOKEN;
  const budgetId = process.env.YNAB_BUDGET_ID;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  const aiModel = process.env.AI_MODEL;

  if (!token || !budgetId) {
    console.error('Missing YNAB_ACCESS_TOKEN or YNAB_BUDGET_ID in .env');
    process.exit(1);
  }

  const ynabClient = new YnabClient(token, budgetId);
  const calendarClient = calendarId ? new CalendarClient(calendarId, googleApiKey) : null;
  const engine = new PatternEngine();
  const identityResolver = (googleApiKey && searchEngineId) 
    ? new IdentityResolver(googleApiKey, searchEngineId, aiModel) 
    : null;

  // Example Temporal Rule:
  engine.addRule({
    id: 'rule-temporal-flight',
    type: 'temporal',
    pattern: 'flight', // Look for 'flight' in calendar events
    categoryId: 'Travel-Category-Id'
  });

  const knownCategories = {
    'Dining': ['restaurant', 'coffee', 'cafe', 'food', 'steak'],
    'Groceries': ['grocery', 'supermarket', 'market'],
    'Travel': ['flight', 'airline', 'hotel', 'motel', 'resort'],
    'Entertainment': ['movie', 'theater', 'tickets', 'concert']
  };

  try {
    console.log('Fetching uncategorized transactions...');
    const uncategorized = await ynabClient.getUncategorizedTransactions();
    console.log(`Found ${uncategorized.length} uncategorized transactions.`);
    
    for (const transaction of uncategorized.slice(0, 5)) {
      console.log(`\nEvaluating transaction: ${transaction.date} | Payee: ${transaction.payee_name} | Amount: ${transaction.amount / 1000}`);
      
      let events: CalendarEvent[] = [];
      if (calendarClient && transaction.date) {
        console.log(`Fetching calendar events around ${transaction.date}...`);
        events = await calendarClient.getEventsAroundDate(transaction.date, 1);
        if (events.length > 0) {
          console.log(`  Found ${events.length} events (e.g., "${events[0].summary}")`);
        }
      }

      let matchedCategoryId = engine.evaluate({
        payeeName: transaction.payee_name,
        date: transaction.date,
        calendarEvents: events,
        accountId: transaction.account_id
      });

      if (!matchedCategoryId && identityResolver && transaction.payee_name) {
        matchedCategoryId = await identityResolver.resolveMerchant(transaction.payee_name, knownCategories);
      }

      if (matchedCategoryId) {
        console.log(`  -> Matched category ID: ${matchedCategoryId}`);
      } else {
        console.log(`  -> No match found.`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
