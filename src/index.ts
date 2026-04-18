import 'dotenv/config';
import { YnabClient } from './ynab.js';
import { CalendarClient } from './calendar.js';
import { PatternEngine } from './pattern-engine.js';
import { CalendarEvent } from "./calendar.js";
import { IdentityResolver } from './identity.js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { evaluateStage1, buildStage2Prompt, buildStage3Prompt, TransactionContext } from './contextual-prompting.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { selectTransactionToEvaluate, displayEvaluationResult } from './ui.js';

async function getAiModel(modelStr: string) {
  const [provider, ...modelParts] = modelStr.split(':');
  const model = modelParts.join(':');

  switch (provider) {
    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(model);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(model);
    }
    case 'openrouter':
      console.log(model)
      const openRouter = createOpenRouter({
        apiKey: process.env.OPEN_ROUTER_API_KEY,
      });
      return openRouter(model);
    case 'openai':
    default: {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
      });
      return openai(model || provider);
    }
  }
}

async function main() {
  const token = process.env.YNAB_ACCESS_TOKEN;
  const budgetId = process.env.YNAB_BUDGET_ID;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const braveApiKey = process.env.BRAVE_API_KEY;
  const aiModel = process.env.AI_MODEL;

  if (!token || !budgetId) {
    console.error('Missing YNAB_ACCESS_TOKEN or YNAB_BUDGET_ID in .env');
    process.exit(1);
  }

  const ynabClient = new YnabClient(token, budgetId);
  const calendarClient = calendarId ? new CalendarClient(calendarId) : null;
  const engine = new PatternEngine();
  const identityResolver = (braveApiKey)
    ? new IdentityResolver(braveApiKey, aiModel)
    : null;

  // Example Temporal Rule:
  // engine.addRule({
  //   id: 'rule-temporal-flight',
  //   type: 'temporal',
  //   pattern: 'flight', // Look for 'flight' in calendar events
  //   categoryId: 'Travel-Category-Id'
  // });

  // engine.addRule({
  //   id: ''
  // })

  const knownCategoriesMap = {
    'Dining': ['restaurant', 'coffee', 'cafe', 'food', 'steak'],
    'Groceries': ['grocery', 'supermarket', 'market', 'coles', 'grocer'],
    'Travel': ['flight', 'airline', 'hotel', 'motel', 'resort'],
    'Entertainment': ['movie', 'theater', 'tickets', 'concert']
  };

  const categoryList = Object.entries(knownCategoriesMap).map(([id, _]) => ({ id, name: id }));

  try {
    console.log('Fetching uncategorized transactions...');
    const uncategorized = await ynabClient.getUncategorizedTransactions();
    console.log(`Found ${uncategorized.length} uncategorized transactions.`);

    p.intro(chalk.bgCyan.black(' YNAB Intelligent Categorizer '));

    let continueEvaluating = true;
    while (continueEvaluating) {
        const selectedOption = await selectTransactionToEvaluate(uncategorized);
        if (!selectedOption) break;

        let txsToProcess = [];
        if (selectedOption === 'ALL') {
            txsToProcess = uncategorized;
        } else {
            txsToProcess = [selectedOption];
        }

        for (const transaction of txsToProcess) {
            const txSpinner = p.spinner();
            txSpinner.start(`Evaluating transaction: ${transaction.date} | Payee: ${transaction.payee_name} | Amount: ${transaction.amount / 1000}`);

            let events: CalendarEvent[] = [];
            if (calendarClient && transaction.date) {
                txSpinner.message(`Fetching calendar events around ${transaction.date}...`);
                events = await calendarClient.getEventsAroundDate(transaction.date, 1);
            }

            const txContext: TransactionContext = {
                payeeName: transaction.payee_name || 'Unknown',
                amount: transaction.amount / 1000,
                date: transaction.date,
                accountId: transaction.account_id
            };

            const patternMatch = engine.evaluate({
                payeeName: transaction.payee_name,
                date: transaction.date,
                calendarEvents: events,
                accountId: transaction.account_id
            });

            let historicalCount = 0;
            if (transaction.payee_id) {
                const history = await ynabClient.getTransactionsByPayee(transaction.payee_id);
                historicalCount = history.length;
            }

            const stage1 = evaluateStage1(txContext, historicalCount, patternMatch ?? undefined);

            if (stage1.hasDeterministicMatch) {
                txSpinner.stop(`Completed Stage 1 evaluation`);
                displayEvaluationResult(transaction, 'Stage 1 (Deterministic)', stage1.matchedCategoryId ? stage1.matchedCategoryId : 'Unknown');
                continue;
            }

            txSpinner.message(`Stage 1 inconclusive. Moving to Stage 2 (Identity Resolution)...`);
            let merchantInfo = '';
            if (identityResolver && transaction.payee_name) {
                const { categoryId, merchantInfo: info } = await identityResolver.resolveMerchant(transaction.payee_name, knownCategoriesMap);
                merchantInfo = info || '';
                if (categoryId) {
                     txSpinner.message(`Identity resolution found category: ${categoryId}. Using as strong signal.`);
                }
            }

            if (aiModel) {
                txSpinner.message('Running Stage 2 AI inference...');
                const prompt = buildStage2Prompt(
                txContext,
                stage1,
                categoryList,
                events.map(e => e.summary),
                merchantInfo
                );

                const model = await getAiModel(aiModel);
                const { text } = await generateText({
                model,
                system: 'You are a helpful financial assistant. Output only the exact category ID from the provided list, or "INCONCLUSIVE" if no match is found. Output nothing else.',
                prompt,
                temperature: 0.1
                });

                const result = text.trim();
                if (result !== 'INCONCLUSIVE' && categoryList.some(c => c.id === result)) {
                    txSpinner.stop(`Completed Stage 2 evaluation`);
                    displayEvaluationResult(transaction, 'Stage 2 (Identity Resolution / Direct AI Match)', result);
                    continue;
                }

                txSpinner.message(`Stage 2 inconclusive. Moving to Stage 3 (Deep Reasoning)...`);
                const fallbackPrompt = buildStage3Prompt(txContext, stage1, result, categoryList);
                const { text: fallbackText } = await generateText({
                model,
                system: 'You are a senior financial analyst. Provide a JSON response with reasoning and confidence.',
                prompt: fallbackPrompt,
                temperature: 0.1
                });

                txSpinner.stop(`Completed Stage 3 evaluation`);

                let parsedResult;
                try {
                     parsedResult = JSON.parse(fallbackText);
                } catch (e) {
                     parsedResult = fallbackText;
                }

                const displayCategory = parsedResult?.suggestedCategoryId || 'INCONCLUSIVE';
                const details = parsedResult?.reasoning ? `Reasoning: ${parsedResult.reasoning}\nConfidence: ${parsedResult.confidence}` : JSON.stringify(parsedResult, null, 2);

                displayEvaluationResult(transaction, 'Stage 3 (Deep Reasoning)', displayCategory, details);
            } else {
                txSpinner.stop('Evaluation stopped');
                p.log.warn(`AI_MODEL not provided, cannot execute Stage 2/3.`);
            }
        }

        if (selectedOption === 'ALL') {
            continueEvaluating = false;
        }
    }


  } catch (error) {
    console.error('Error:', error);
  }
}

main();
