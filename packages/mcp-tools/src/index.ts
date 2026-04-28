/**
 * @scholar-swarm/mcp-tools
 *
 * Concrete RetrievalProvider impls used by the Researcher (search) and Critic
 * (re-fetch + verify). Two backends ship: Tavily (hosted API, fast, requires
 * a free API key) and SearXNG (self-hosted aggregator, zero vendor lock-in).
 * Swap by wiring a different provider into AgentProviders.retrieval.
 */

export { TavilyRetrievalProvider, type TavilyConfig } from "./tavily.js";
export { SearxRetrievalProvider, type SearxConfig } from "./searxng.js";
