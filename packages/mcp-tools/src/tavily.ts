/**
 * TavilyRetrievalProvider — RetrievalProvider impl backed by tavily.com Search API.
 *
 * Why Tavily? It's the LLM-native search API (returns title/url/content + score
 * per hit, optimized for retrieval-augmented generation). Free tier covers the
 * hackathon demo. The same interface lets a future build swap to Brave / Exa /
 * SerpAPI without touching agent code.
 *
 * The Researcher agent reads sources via this provider, then passes their
 * excerpts to TEE-attested inference. The Critic re-fetches the same URLs
 * via `fetchUrl()` for HTTP-200 + semantic-match verification — that's the
 * "AutoGPT can hallucinate sources, we can't" mechanism in code form.
 */

import type { RetrievalProvider, RetrievalResult } from "@scholar-swarm/sdk";

export interface TavilyConfig {
  apiKey: string;
  /** Default: "advanced" — slower but better-grounded results, worth it for research. */
  searchDepth?: "basic" | "advanced";
  /** Endpoint override (for self-host / proxy). */
  endpoint?: string;
}

interface TavilyApiResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

interface TavilySearchResponse {
  query: string;
  results: TavilyApiResult[];
}

export class TavilyRetrievalProvider implements RetrievalProvider {
  readonly name = "tavily";

  private apiKey: string;
  private searchDepth: "basic" | "advanced";
  private endpoint: string;

  constructor(cfg: TavilyConfig) {
    if (!cfg.apiKey) throw new Error("TavilyRetrievalProvider: apiKey is required");
    this.apiKey = cfg.apiKey;
    this.searchDepth = cfg.searchDepth ?? "advanced";
    this.endpoint = cfg.endpoint ?? "https://api.tavily.com";
  }

  async search(query: string, opts: { maxResults?: number } = {}): Promise<RetrievalResult[]> {
    const body = {
      api_key: this.apiKey,
      query,
      search_depth: this.searchDepth,
      max_results: opts.maxResults ?? 5,
      include_answer: false,
      include_raw_content: false,
    };

    const resp = await fetch(`${this.endpoint}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Tavily search failed: ${resp.status} ${resp.statusText} ${text.slice(0, 200)}`);
    }

    const data = (await resp.json()) as TavilySearchResponse;
    return (data.results ?? []).map((r): RetrievalResult => {
      const out: RetrievalResult = { url: r.url, title: r.title, content: r.content };
      if (typeof r.score === "number") out.score = r.score;
      return out;
    });
  }

  /**
   * Fetch a URL's body. The Critic uses this to verify a Researcher's claim
   * still resolves (HTTP 200) and contains the excerpts referenced.
   *
   * We use a plain `fetch` here — Tavily has an /extract endpoint but for
   * verification we want the actual server response, not a re-summarized body.
   */
  async fetchUrl(url: string): Promise<{ status: number; content: string }> {
    try {
      const resp = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; ScholarSwarm-Critic/0.0.1; +https://github.com/Himess/scholar-swarm)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      const content = await resp.text().catch(() => "");
      return { status: resp.status, content };
    } catch (err) {
      return { status: 0, content: `fetch_error:${(err as Error).message}` };
    }
  }
}
