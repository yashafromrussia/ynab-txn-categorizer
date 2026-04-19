import 'dotenv/config';
import { YnabClient } from './ynab.js';
import { CalendarClient } from './calendar.js';
import { PatternEngine } from './pattern-engine.js';
import { CalendarEvent } from "./calendar.js";
import { CorrelationResolver } from "./correlation.js";
import { ConfigManager } from './config.js';
import { IdentityResolver } from './identity.js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { evaluateStage1, buildStage2Prompt, buildStage3Prompt, TransactionContext } from './contextual-prompting.js';
import { evaluateConfidence, CategorizationTrace, saveTrace } from './confidence-scoring.js';
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
  const configManager = new ConfigManager();
  const appConfig = configManager.getConfig();

  const engine = new PatternEngine();
  appConfig.rules.forEach(rule => engine.addRule(rule));

  const correlationResolver = new CorrelationResolver({
      ambiguousPayees: appConfig.ambiguousPayees,
      amountTolerance: appConfig.amountTolerance,
      dateWindowDays: appConfig.dateWindowDays,
      requireCrossAccount: appConfig.requireCrossAccount,
      minConfidence: appConfig.minConfidence
  });
  const identityResolver = (braveApiKey)
    ? new IdentityResolver(braveApiKey, aiModel)
    : null;

  const knownCategoriesMap = appConfig.knownCategories;

  try {
    console.log('Fetching budget categories...');
    const categories = await ynabClient.getCategories();
    const categoryMap = new Map<string, string>();
    categories.forEach(c => categoryMap.set(c.id, c.name));

    // The categoryList passed to the AI should be the actual YNAB categories
    const categoryList = categories.map(c => ({ id: c.id, name: c.name }));

    const getCategoryName = (id: string | null | undefined, tx?: any) => {
        if (!id) return 'Unknown';
        if (tx && tx.category_name) return tx.category_name;
        return categoryMap.get(id) || id;
    };

    console.log('Fetching uncategorized transactions...');
    const uncategorized = await ynabClient.getUnapprovedTransactions();
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

            const baseTrace: Omit<CategorizationTrace, 'assigned_category_id' | 'confidence_score' | 'tier' | 'stage_resolved' | 'llm_reasoning'> = {
              transaction_id: transaction.id,
              payee_name: transaction.payee_name || 'Unknown',
              timestamp: new Date().toISOString(),
              signals_used: {
                deterministic_rule_id: patternMatch ? 'rule' : null,
                calendar_event_id: events.length > 0 ? events[0].id : null,
                search_identity_resolved: false,
                account_heuristic_applied: false
              }
            };

            if (stage1.hasDeterministicMatch) {
                const evalConf = evaluateConfidence(1.0, 1);
                txSpinner.stop(`Completed Stage 1 evaluation`);

                const trace: CategorizationTrace = {
                  ...baseTrace,
                  assigned_category_id: stage1.matchedCategoryId || null,
                  confidence_score: evalConf.score,
                  tier: evalConf.tier,
                  stage_resolved: 1,
                  llm_reasoning: null
                };

                await saveTrace(trace);
                displayEvaluationResult(transaction, `Stage 1 (Tier: ${evalConf.tier}, Score: ${evalConf.score})`, stage1.matchedCategoryId ? stage1.matchedCategoryId : 'Unknown');
                continue;
            }

            let forceCorrelation = false;
            if (selectedOption !== 'ALL' && transaction.payee_name && correlationResolver.isAmbiguous(transaction.payee_name)) {
                 txSpinner.stop(`Detected ambiguous payee: ${transaction.payee_name}`);
                 const shouldForce = await p.confirm({
                    message: `Payee "${transaction.payee_name}" is known to be ambiguous. Force transaction through correlation flow?`,
                    initialValue: true
                 });
                 if (!p.isCancel(shouldForce)) {
                     forceCorrelation = shouldForce as boolean;
                 }
                 txSpinner.start(`Resuming evaluation: ${transaction.date} | Payee: ${transaction.payee_name}`);
            }

            if (forceCorrelation || (transaction.payee_name && correlationResolver.isAmbiguous(transaction.payee_name))) {
                txSpinner.message(`Stage 1.5: Running correlation for ambiguous payee...`);
                const correlationResult = await correlationResolver.correlate(transaction, ynabClient);

                if (correlationResult.categoryId || (correlationResult.subtransactions && correlationResult.subtransactions.length > 0)) {
                     txSpinner.stop(`Completed Stage 1.5 evaluation`);
                     const trace: CategorizationTrace = {
                        ...baseTrace,
                        assigned_category_id: correlationResult.categoryId,
                        subtransactions: correlationResult.subtransactions,
                        confidence_score: 0.9,
                        tier: 'Auto',
                        stage_resolved: 1,
                        llm_reasoning: correlationResult.reasoning
                     };
                     await saveTrace(trace);
                     
                     let resultDisplay = correlationResult.categoryId ? getCategoryName(correlationResult.categoryId) : 'Split';
                     
                     let details = `Reasoning: ${correlationResult.reasoning}`;
                     if (correlationResult.subtransactions && correlationResult.subtransactions.length > 0) {
                         details += `\nSplits:\n`;
                         correlationResult.subtransactions.forEach(st => {
                             details += `  - ${(st.amount/1000).toFixed(2)}: ${getCategoryName(st.category_id, st)}\n`;
                         });
                     }

                     displayEvaluationResult(transaction, `Stage 1.5 Correlation (Tier: Auto, Score: 0.9)`, resultDisplay, details);
                     continue;
                } else {
                     txSpinner.message(`Stage 1.5 Correlation unsuccessful: ${correlationResult.reasoning}`);
                }
            }
            let merchantInfo = '';
            if (identityResolver && transaction.payee_name) {
                const { categoryId, merchantInfo: info } = await identityResolver.resolveMerchant(transaction.payee_name, knownCategoriesMap);
                merchantInfo = info || '';
                if (categoryId) {
                     txSpinner.message(`Identity resolution found category: ${categoryId}. Using as strong signal.`);
                     baseTrace.signals_used.search_identity_resolved = true;
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
                  system: 'You are a helpful financial assistant. Output ONLY a valid JSON object matching the requested schema. No markdown, no extra text.',
                  prompt,
                  temperature: 0.1
                });

                let stage2Parsed;
                try {
                  stage2Parsed = JSON.parse(text.trim());
                } catch (e) {
                  stage2Parsed = { recommendedCategoryId: null, confidenceScore: 0, reasoning: "JSON parsing failed" };
                }

                const s2Cat = stage2Parsed.recommendedCategoryId;
                const s2Conf = typeof stage2Parsed.confidenceScore === 'number' ? stage2Parsed.confidenceScore : 0;

                if (s2Cat && categoryList.some(c => c.id === s2Cat)) {
                    const evalConf = evaluateConfidence(s2Conf, 2);

                    if (evalConf.tier === 'Auto' || evalConf.tier === 'Suggest') {
                        txSpinner.stop(`Completed Stage 2 evaluation`);

                        const trace: CategorizationTrace = {
                          ...baseTrace,
                          assigned_category_id: s2Cat,
                          confidence_score: evalConf.score,
                          tier: evalConf.tier,
                          stage_resolved: 2,
                          llm_reasoning: stage2Parsed.reasoning || null
                        };

                        await saveTrace(trace);
                        displayEvaluationResult(transaction, `Stage 2 (Tier: ${evalConf.tier}, Score: ${evalConf.score})`, s2Cat, `Reasoning: ${stage2Parsed.reasoning || ''}`);
                        continue;
                    } else {
                        txSpinner.message(`Stage 2 score (${evalConf.score}) too low for Auto/Suggest. Moving to Stage 3...`);
                    }
                } else {
                    txSpinner.message(`Stage 2 inconclusive. Moving to Stage 3 (Deep Reasoning)...`);
                }

                const fallbackPrompt = buildStage3Prompt(txContext, stage1, JSON.stringify(stage2Parsed), categoryList);
                const { text: fallbackText } = await generateText({
                  model,
                  system: 'You are a senior financial analyst. Output ONLY a valid JSON object matching the requested schema. No markdown, no extra text.',
                  prompt: fallbackPrompt,
                  temperature: 0.1
                });

                txSpinner.stop(`Completed Stage 3 evaluation`);

                let parsedResult;
                try {
                     parsedResult = JSON.parse(fallbackText.trim());
                } catch (e) {
                     parsedResult = { recommendedCategoryId: null, confidenceScore: 0, reasoning: "JSON parsing failed" };
                }

                const displayCategory = parsedResult.recommendedCategoryId || 'INCONCLUSIVE';
                const s3Conf = typeof parsedResult.confidenceScore === 'number' ? parsedResult.confidenceScore : 0;
                const evalConf = evaluateConfidence(s3Conf, 3);

                const trace: CategorizationTrace = {
                  ...baseTrace,
                  assigned_category_id: displayCategory === 'INCONCLUSIVE' ? null : displayCategory,
                  confidence_score: evalConf.score,
                  tier: evalConf.tier,
                  stage_resolved: 3,
                  llm_reasoning: parsedResult.reasoning || null
                };

                await saveTrace(trace);
                const details = `Tier: ${evalConf.tier} (Score: ${evalConf.score})\nReasoning: ${parsedResult.reasoning || ''}`;
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
