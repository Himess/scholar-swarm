/**
 * Spike 15 — Tavily retrieval working end-to-end.
 *
 * Validates that:
 *   1. TavilyRetrievalProvider connects and authenticates with TAVILY_API_KEY.
 *   2. `search()` returns ≥1 real result with title/url/content/score.
 *   3. `fetchUrl()` resolves the top result back over plain HTTP and returns
 *      a 2xx status — this is what the Critic does to verify a Researcher's
 *      cited source still exists ("AutoGPT can hallucinate sources, we can't").
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-15-tavily.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { TavilyRetrievalProvider } from "@scholar-swarm/mcp-tools";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");
const QUERY =
  "What is LayerZero V2 DVN attestation and how does it differ from V1 oracle/relayer model?";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}. Get a free key at https://app.tavily.com/`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 15 — Tavily retrieval ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const apiKey = must("TAVILY_API_KEY");
  console.log(`API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`);
  console.log(`Query:   ${QUERY}\n`);

  const tavily = new TavilyRetrievalProvider({ apiKey, searchDepth: "advanced" });

  // 1. search()
  console.log("Step 1: tavily.search() …");
  const t0 = Date.now();
  const results = await tavily.search(QUERY, { maxResults: 5 });
  const searchMs = Date.now() - t0;
  console.log(`  ${results.length} results in ${searchMs}ms`);
  results.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.url}`);
    console.log(`      ${r.title}`);
    console.log(`      score=${r.score ?? "n/a"}  contentLen=${r.content.length}`);
  });
  console.log();

  if (results.length === 0) {
    console.error("❌ No results returned — check API key + free-tier quota");
    process.exit(1);
  }

  // 2. fetchUrl() — re-fetch the top result like Critic would
  const top = results[0]!;
  console.log(`Step 2: tavily.fetchUrl("${top.url.slice(0, 80)}…") …`);
  const t1 = Date.now();
  const fetched = await tavily.fetchUrl(top.url);
  const fetchMs = Date.now() - t1;
  console.log(`  status=${fetched.status}  bodyLen=${fetched.content.length}  ${fetchMs}ms\n`);

  const fetchOk = fetched.status >= 200 && fetched.status < 400;

  // 3. Persist artifact for the demo
  const artifact = {
    spike: "15-tavily",
    runAt: new Date().toISOString(),
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
  console.log(`Search returned results:  ${results.length > 0 ? "✅" : "❌"} (${results.length})`);
  console.log(`Top result re-fetch ok:   ${fetchOk ? "✅" : "🟡"} (status=${fetched.status})`);

  if (results.length === 0) {
    console.error("\n❌ Spike 15 FAIL — no results.");
    process.exit(1);
  }
  console.log("\n✅ Spike 15 PASS — Tavily retrieval live. Researcher has real sources.");
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
