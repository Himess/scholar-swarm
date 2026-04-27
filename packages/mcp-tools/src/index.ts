/**
 * @scholar-swarm/mcp-tools
 *
 * Concrete RetrievalProvider impls used by the Researcher (search) and Critic
 * (re-fetch + verify). Tavily is the default; swap by wiring a different
 * provider into AgentProviders.retrieval.
 */

export { TavilyRetrievalProvider, type TavilyConfig } from "./tavily.js";
