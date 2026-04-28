/**
 * SearxRetrievalProvider — RetrievalProvider impl backed by a self-hosted SearXNG.
 *
 * Why SearXNG over a hosted API like Tavily? Two reasons specific to Scholar
 * Swarm:
 *   1. Vendor independence. The "trustless multi-agent" pitch contradicts a
 *      single-vendor third-party search dependency. SearXNG is open source
 *      (AGPL-3.0) and can be operated by anyone running our SDK.
 *   2. Federation, not API. SearXNG aggregates Google / Bing / DuckDuckGo /
 *      Wikipedia / etc. behind a unified JSON endpoint, so the Researcher
 *      gets multi-source diversity without writing per-engine adapters.
 *
 * Operationally we run SearXNG on the same EU VPS that hosts the AXL listener
 * (Spike 2b). Port 8888 is bound to 127.0.0.1 only and reached from the laptop
 * over an SSH tunnel — no public exposure. The exact same `RetrievalProvider`
 * interface is implemented as `TavilyRetrievalProvider` in `./tavily.ts`, so
 * an Agent runtime can swap providers with one config flip.
 */

import type { RetrievalProvider, RetrievalResult } from "@scholar-swarm/sdk";

export interface SearxConfig {
  /** Full base URL, e.g. http://127.0.0.1:8888 (SSH-tunnelled) or http://localhost:8888 (local Docker). */
  endpoint: string;
  /** Optional categories filter (e.g. "general", "it"). Default: general. */
  categories?: string;
  /** Optional language preference. Default: "en". */
  language?: string;
  /** Optional Bearer token if your SearXNG is behind auth. */
  bearerToken?: string;
  /** HTTP timeout per request. Default: 15s. */
  timeoutMs?: number;
}

interface SearxApiResult {
  url: string;
  title: string;
  content?: string;
  engine?: string;
  score?: number;
  thumbnail?: string;
  publishedDate?: string;
}

interface SearxResponse {
  query: string;
  results: SearxApiResult[];
  number_of_results?: number;
}

export class SearxRetrievalProvider implements RetrievalProvider {
  readonly name = "searxng";

  private endpoint: string;
  private categories: string;
  private language: string;
  private bearerToken: string | undefined;
  private timeoutMs: number;

  constructor(cfg: SearxConfig) {
    if (!cfg.endpoint) throw new Error("SearxRetrievalProvider: endpoint is required");
    this.endpoint = cfg.endpoint.replace(/\/$/, "");
    this.categories = cfg.categories ?? "general";
    this.language = cfg.language ?? "en";
    this.bearerToken = cfg.bearerToken;
    this.timeoutMs = cfg.timeoutMs ?? 15_000;
  }

  async search(query: string, opts: { maxResults?: number } = {}): Promise<RetrievalResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      categories: this.categories,
      language: this.language,
    });

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.bearerToken) headers["Authorization"] = `Bearer ${this.bearerToken}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(`${this.endpoint}/search?${params.toString()}`, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`SearXNG search failed: ${resp.status} ${resp.statusText} ${text.slice(0, 200)}`);
    }

    const data = (await resp.json()) as SearxResponse;
    const max = opts.maxResults ?? 5;
    return (data.results ?? []).slice(0, max).map((r): RetrievalResult => {
      const out: RetrievalResult = {
        url: r.url,
        title: r.title,
        content: r.content ?? "",
      };
      if (typeof r.score === "number") out.score = r.score;
      return out;
    });
  }

  /**
   * Critic re-fetch path. Same shape as TavilyRetrievalProvider.fetchUrl —
   * plain `fetch` with a friendly UA so we get the actual server response,
   * not a re-summarized body.
   */
  async fetchUrl(url: string): Promise<{ status: number; content: string }> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const resp = await fetch(url, {
          redirect: "follow",
          signal: ctrl.signal,
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; ScholarSwarm-Critic/0.0.1; +https://github.com/Himess/scholar-swarm)",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        const content = await resp.text().catch(() => "");
        return { status: resp.status, content };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      return { status: 0, content: `fetch_error:${(err as Error).message}` };
    }
  }
}
