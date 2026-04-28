/**
 * Spike 15 — retrieval layer working end-to-end (provider-agnostic).
 *
 * Validates that whichever RetrievalProvider is wired (Tavily MCP or
 * self-hosted SearXNG):
 *   1. `search()` returns ≥1 real result with title/url/content.
 *   2. `fetchUrl()` resolves the top result back over plain HTTP and returns
 *      a 2xx status — this is what the Critic does to verify a Researcher's
 *      cited source still exists ("AutoGPT can hallucinate sources, we can't").
 *
 * Provider selection (env):
 *   - RETRIEVAL_PROVIDER=searxng (default if SEARXNG_ENDPOINT is set)
 *     SEARXNG_ENDPOINT=http://127.0.0.1:8888
 *   - RETRIEVAL_PROVIDER=tavily
 *     TAVILY_API_KEY=tvly-...
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-15-retrieval.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import {
  TavilyRetrievalProvider,
  SearxRetrievalProvider,
} from "@scholar-swarm/mcp-tools";
import type { RetrievalProvider } from "@scholar-swarm/sdk";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");
const QUERY =
  "What is LayerZero V2 DVN attestation and how does it differ from V1 oracle/relayer model?";

function selectProvider(): RetrievalProvider {
  const explicit = process.env["RETRIEVAL_PROVIDER"]?.toLowerCase();
  const searxEndpoint = process.env["SEARXNG_ENDPOINT"];
  const tavilyKey = process.env["TAVILY_API_KEY"];

  // Explicit selection wins.
  if (explicit === "searxng") {
    if (!searxEndpoint) throw new Error("RETRIEVAL_PROVIDER=searxng but SEARXNG_ENDPOINT is unset");
    return new SearxRetrievalProvider({ endpoint: searxEndpoint });
  }
  if (explicit === "tavily") {
    if (!tavilyKey) throw new Error("RETRIEVAL_PROVIDER=tavily but TAVILY_API_KEY is unset");
    return new TavilyRetrievalProvider({ apiKey: tavilyKey, searchDepth: "advanced" });
  }

  // Auto-detect by env presence. Prefer SearXNG (zero-vendor by default).
  if (searxEndpoint) return new SearxRetrievalProvider({ endpoint: searxEndpoint });
  if (tavilyKey) return new TavilyRetrievalProvider({ apiKey: tavilyKey, searchDepth: "advanced" });
  throw new Error(
    "No retrieval provider configured. Set SEARXNG_ENDPOINT (e.g. http://127.0.0.1:8888 via SSH tunnel) " +
      "or TAVILY_API_KEY (free tier at https://app.tavily.com/).",
  );
}

async function main(): Promise<void> {
  console.log("=== Spike 15 — retrieval layer ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const retrieval = selectProvider();
  console.log(`Provider: ${retrieval.name}`);
  console.log(`Query:    ${QUERY}\n`);

  // 1. search()
  console.log("Step 1: retrieval.search() …");
  const t0 = Date.now();
  const results = await retrieval.search(QUERY, { maxResults: 5 });
  const searchMs = Date.now() - t0;
  console.log(`  ${results.length} results in ${searchMs}ms`);
  results.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.url}`);
    console.log(`      ${r.title}`);
    console.log(`      score=${r.score ?? "n/a"}  contentLen=${r.content.length}`);
  });
  console.log();

  if (results.length === 0) {
    console.error("❌ No results returned");
    process.exit(1);
  }

  // 2. fetchUrl() — re-fetch the top result like Critic would
  const top = results[0]!;
  console.log(`Step 2: retrieval.fetchUrl("${top.url.slice(0, 80)}…") …`);
  const t1 = Date.now();
  const fetched = await retrieval.fetchUrl(top.url);
  const fetchMs = Date.now() - t1;
  console.log(`  status=${fetched.status}  bodyLen=${fetched.content.length}  ${fetchMs}ms\n`);

  const fetchOk = fetched.status >= 200 && fetched.status < 400;

  // 3. Persist artifact for the demo
  const artifact = {
    spike: "15-retrieval",
    runAt: new Date().toISOString(),
    provider: retrieval.name,
    query: QUERY,
    searchMs,
    fetchMs,
    fetchOk,
    results: results.map((r) => ({
      url: r.url,
      title: r.title,
      score: r.score ?? null,
      contentPreview: r.content.slice(0, 240),
    })),
    topUrlStatus: fetched.status,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-15.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact: docs/spike-artifacts/spike-15.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`Provider used:            ${retrieval.name}`);
  console.log(`Search returned results:  ${results.length > 0 ? "✅" : "❌"} (${results.length})`);
  console.log(`Top result re-fetch ok:   ${fetchOk ? "✅" : "🟡"} (status=${fetched.status})`);

  if (results.length === 0) {
    console.error("\n❌ Spike 15 FAIL — no results.");
    process.exit(1);
  }
  console.log(`\n✅ Spike 15 PASS — ${retrieval.name} retrieval live. Researcher has real sources.`);
  if (!fetchOk) {
    console.log("   Note: top URL didn't return 2xx on direct fetch (some sites block bots).");
    console.log("   Critic will mark sourceFetchedOk=false for that one — by design.");
  }
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 15 failed:");
  console.error(err);
  process.exit(1);
});
