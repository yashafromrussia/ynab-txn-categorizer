import { BraveSearchClient, BraveSearchResponse } from './brave-search.js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export class IdentityResolver {
  private searchClient: BraveSearchClient;
  private modelName?: string;

  constructor(braveApiKey: string, modelName?: string) {
    this.searchClient = new BraveSearchClient(braveApiKey);
    this.modelName = modelName;
  }

  private getAiModel(modelStr: string) {
    const [provider, ...modelParts] = modelStr.split(':');
    const model = modelParts.join(':');
    console.log('getAiModel', model, provider)

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

  async resolveMerchant(payeeName: string, knownCategories: Record<string, string[]>): Promise<{ categoryId: string | null; merchantInfo: string | null }> {
    if (!payeeName) return { categoryId: null, merchantInfo: null };

    try {
      console.log(`  [Identity] Searching Brave for "${payeeName}"...`);
      const res = await this.searchClient.search({
        q: payeeName,
        count: 3
      });

      const items = res.web.results || [];
      if (items.length === 0) {
        console.log(`  [Identity] No search results found for "${payeeName}".`);
        return { categoryId: null, merchantInfo: null };
      }

      const searchContext = items.map((i: any) => `${i.title}\\n${i.snippet}`).join('\\n\\n');

      for (const [categoryId, keywords] of Object.entries(knownCategories)) {
        for (const kw of keywords) {
          if (searchContext.toLowerCase().includes(kw.toLowerCase())) {
            console.log(`  [Identity] Found exact keyword match: "${kw}" -> Category: ${categoryId}`);
            return { categoryId, merchantInfo: searchContext };
          }
        }
      }

      if (this.modelName) {
        console.log(`  [Identity] No exact keyword match. Falling back to LLM (${this.modelName})...`);
        const categoryId = await this.resolveWithLLM(payeeName, searchContext, Object.keys(knownCategories));
        return { categoryId, merchantInfo: searchContext };
      } else {
        console.log(`  [Identity] No exact keyword match and no AI_MODEL provided.`);
      }
    } catch (error) {
      console.error(`  [Identity] Error resolving merchant:`, error);
    }

    return { categoryId: null, merchantInfo: null };
  }


  private async resolveWithLLM(payeeName: string, searchContext: string, categories: string[]): Promise<string | null> {
    if (!this.modelName) return null;

    const prompt = `
You are a transaction categorization assistant.
I have an obscure bank transaction payee: "${payeeName}".

Here are some web search results for this payee:
---
${searchContext}
---

Based on the search results, determine the most likely category from this list:
[${categories.join(', ')}]

Return ONLY the exact category name from the list. If you are unsure, return "Unknown".
`;

    try {
      const model = this.getAiModel(this.modelName);
      const { text } = await generateText({
        model,
        system: 'You are a helpful financial assistant. Output only the exact category name from the provided list, or "Unknown" if no match is found. Output nothing else.',
        prompt,
        temperature: 0.1
      });

      const answer = text.trim();

      if (answer && categories.includes(answer)) {
        console.log(`  [Identity] LLM resolved to category: ${answer}`);
        return answer;
      } else {
        console.log(`  [Identity] LLM could not resolve (returned: "${answer}").`);
        return null;
      }

    } catch (error) {
      console.error(`  [Identity] LLM Error:`, error);
      return null;
    }
  }
}
