export type BraveWebSearchParams = {
  q: string;
  country?: string;
  search_lang?: string;
  ui_lang?: string;
  count?: number;
  offset?: number;
  safesearch?: 'off' | 'moderate' | 'strict';
  freshness?: string;
};

export interface BraveSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface BraveSearchResponse {
  web: {
    results: BraveSearchResult[];
  };
  query: {
    more_results_available: boolean;
  };
}

export class BraveSearchClient {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.BRAVE_API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error('Brave API key is not defined. Please set BRAVE_API_KEY in your environment.');
    }
  }

  async search(params: BraveWebSearchParams): Promise<BraveSearchResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', params.q);
    
    if (params.country) url.searchParams.set('country', params.country);
    if (params.count) url.searchParams.set('count', String(params.count));
    if (params.offset) url.searchParams.set('offset', String(params.offset));
    if (params.search_lang) url.searchParams.set('search_lang', params.search_lang);
    if (params.ui_lang) url.searchParams.set('ui_lang', params.ui_lang);
    if (params.safesearch) url.searchParams.set('safesearch', params.safesearch);
    if (params.freshness) url.searchParams.set('freshness', params.freshness);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Subscription-Token': this.apiKey,
    };

    const res = await fetch(url.toString(), { headers });

    if (res.status === 429) {
      console.warn('[BraveSearch] Rate limit hit. Retrying once...');
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      const retry = await fetch(url.toString(), { headers });
      if (!retry.ok) throw new Error(`Brave search retry failed: ${retry.status}`);
      return retry.json();
    }

    if (!res.ok) {
      throw new Error(`Brave search failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }
}
