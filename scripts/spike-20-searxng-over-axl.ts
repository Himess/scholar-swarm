/**
 * Spike 20 — SearXNG retrieval over MCP-over-AXL.
 *
 * Goal: prove the MCP-over-AXL pattern (Spike 3, mock router) extended to a
 * REAL upstream tool. One AXL peer hosts a JSON-RPC router that proxies a live
 * SearXNG instance; another AXL peer makes a federated web-search call by
 * routing through the Yggdrasil mesh — no SSH tunnel, no shared HTTP, no
 * out-of-band coordination. Closes the loop on the AXL pitch ("agent-to-tool
 * coordination is what AXL was designed for") with the actual production
 * retrieval provider.
 *
 * Topology
 *
 *   ┌──────── caller ────────┐                         ┌───── host ─────┐
 *   │ axl-node-a             │  Yggdrasil TLS overlay  │ axl-node-b     │
 *   │ api_port 9002          │ ◀════════════════════▶ │ api_port 9012  │
 *   │ (no router)            │                         │ router→9003    │
 *   └────────────────────────┘                         └────────┬───────┘
 *                                                                │
 *                                            ┌───────────────────▼──────────────────┐
 *                                            │ searxng-mcp-router.js (port 9003)    │
 *                                            │   POST / {jsonrpc:"2.0",method:...}  │
 *                                            │   → fetches SEARXNG_ENDPOINT/search  │
 *                                            └──────────────────┬───────────────────┘
 *                                                               │
 *                                              SearXNG (Docker) │
 *                                              http://127.0.0.1:8888 (SSH tunnel)
 *
 * The MCP-over-AXL request from the caller is:
 *
 *   POST http://127.0.0.1:9002/mcp/{b_peer_id}/searxng
 *   Content-Type: application/json
 *   { "jsonrpc":"2.0", "id":1, "method":"search",
 *     "params":{ "query":"<…>", "max_results": 5 } }
 *
 * AXL forwards through node-b → searxng-mcp-router.js → upstream SearXNG → back.
 *
 * Run:
 *   pnpm exec tsx --env-file=.env scripts/spike-20-searxng-over-axl.ts
 *
 * Requires SEARXNG_ENDPOINT to be reachable (default: http://127.0.0.1:8888 —
 * the VPS SSH tunnel from Spike 15). The script pre-flights SearXNG before
 * spawning AXL so failures fail fast with a clear message.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ARTIFACTS_DIR = join(ROOT, "docs", "spike-artifacts");
const SEARXNG_ENDPOINT = (process.env["SEARXNG_ENDPOINT"] || "http://127.0.0.1:8888").replace(/\/$/, "");
const NODE_A = {
  cwd: join(ROOT, "infra", "axl-node-a"),
  apiPort: 9002,
};
const NODE_B = {
  cwd: join(ROOT, "infra", "axl-node-b"),
  apiPort: 9012,
};
const ROUTER_PORT = 9003;
const QUERY = "LayerZero V2 vs Wormhole security model 2026";

interface ChildEntry {
  name: string;
  child: ChildProcess;
  buf: string;
}
const procs: ChildEntry[] = [];

function spawnTracked(name: string, exe: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): ChildEntry {
  if (!existsSync(exe)) throw new Error(`Binary missing: ${exe}`);
  const child = spawn(exe, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  const entry: ChildEntry = { name, child, buf: "" };
  child.stdout?.on("data", (chunk: Buffer) => {
    const s = chunk.toString();
    entry.buf += s;
    process.stdout.write(`[${name}] ${s.trimEnd()}\n`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    const s = chunk.toString();
    entry.buf += s;
    process.stderr.write(`[${name}!] ${s.trimEnd()}\n`);
  });
  procs.push(entry);
  return entry;
}

function killAll(): void {
  for (const p of procs.reverse()) {
    try {
      p.child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}
process.on("SIGINT", () => {
  killAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(143);
});

async function preflightSearXNG(): Promise<void> {
  const url = `${SEARXNG_ENDPOINT}/search?q=ping&format=json&categories=general`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    await resp.json();
    console.log(`  ✓ SearXNG reachable at ${SEARXNG_ENDPOINT}`);
  } catch (e) {
    throw new Error(
      `SearXNG NOT reachable at ${SEARXNG_ENDPOINT}: ${(e as Error).message}\n  Open the SSH tunnel first: ssh -L 8888:127.0.0.1:8888 root@<vps>`,
    );
  }
}

function extractPeerIdFromBuf(buf: string): string | null {
  // AXL logs "Our Public Key: <hex>" on startup
  const m = buf.match(/Our Public Key:\s*([0-9a-fA-F]+)/);
  return m && m[1] ? m[1] : null;
}

async function waitForApi(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/topology`, { signal: AbortSignal.timeout(2000) });
      if (resp.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`AXL API on port ${port} did not come up within ${timeoutMs}ms`);
}

async function waitForPeer(callerApiPort: number, expectedPeers = 1, timeoutMs = 20_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`http://127.0.0.1:${callerApiPort}/topology`, { signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const data = (await resp.json()) as { peers?: unknown[] };
        const count = data.peers?.length ?? 0;
        if (count >= expectedPeers) return count;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`AXL caller saw < ${expectedPeers} peer(s) within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  console.log("=== Spike 20 — SearXNG retrieval over MCP-over-AXL ===");
  console.log(`SEARXNG_ENDPOINT = ${SEARXNG_ENDPOINT}`);
  console.log(`Caller AXL  = node-a (api :${NODE_A.apiPort})`);
  console.log(`Host AXL    = node-b (api :${NODE_B.apiPort}, router :${ROUTER_PORT})`);
  console.log(`Router      = infra/axl-node-b/searxng-mcp-router.js`);
  console.log("");

  // Step 1 — pre-flight SearXNG so we fail fast if the SSH tunnel isn't open.
  console.log("[1/6] Pre-flight SearXNG...");
  await preflightSearXNG();

  // Step 2 — spawn the SearXNG-MCP router on port 9003 (where node-b's AXL forwards).
  console.log("[2/6] Spawning searxng-mcp-router.js on port " + ROUTER_PORT + "...");
  const routerScript = join(NODE_B.cwd, "searxng-mcp-router.js");
  spawnTracked("router", process.execPath, [routerScript], NODE_B.cwd, {
    ...process.env,
    SEARXNG_ENDPOINT,
    ROUTER_PORT: String(ROUTER_PORT),
  });
  await new Promise((r) => setTimeout(r, 800));

  // Step 3 — spawn axl-node-a (caller) and axl-node-b (host).
  console.log("[3/6] Spawning AXL nodes (a=caller, b=host)...");
  const nodeA = spawnTracked("axl-a", join(NODE_A.cwd, "node.exe"), ["-config", "node-config.json"], NODE_A.cwd);
  await new Promise((r) => setTimeout(r, 400));
  const nodeB = spawnTracked("axl-b", join(NODE_B.cwd, "node.exe"), ["-config", "node-config.json"], NODE_B.cwd);

  // Wait for both APIs to come up
  await waitForApi(NODE_A.apiPort, 20_000);
  await waitForApi(NODE_B.apiPort, 20_000);

  // Step 4 — wait for peering and read host peer ID from logs.
  console.log("[4/6] Waiting for AXL mesh formation...");
  const peers = await waitForPeer(NODE_A.apiPort, 1, 25_000);
  console.log(`  ✓ caller sees ${peers} peer(s)`);

  // Give logs a beat to settle so we can scrape peer IDs
  await new Promise((r) => setTimeout(r, 1500));
  const hostPeerId = extractPeerIdFromBuf(nodeB.buf);
  if (!hostPeerId) {
    throw new Error("Could not extract host peer ID from axl-b log output (no 'Our Public Key:' line found)");
  }
  console.log(`  host peer id = ${hostPeerId.slice(0, 16)}…`);

  // Step 5 — make MCP-over-AXL search call.
  console.log("[5/6] POST /mcp/{host_peer}/searxng  method=search  query=" + JSON.stringify(QUERY));
  const t0 = Date.now();
  const url = `http://127.0.0.1:${NODE_A.apiPort}/mcp/${hostPeerId}/searxng`;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "search",
    params: { query: QUERY, max_results: 5 },
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const elapsed = Date.now() - t0;
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`AXL /mcp call failed: HTTP ${resp.status} ${resp.statusText} :: ${txt.slice(0, 400)}`);
  }
  const json = (await resp.json()) as {
    jsonrpc?: string;
    id?: unknown;
    result?: { query?: string; count?: number; results?: { url: string; title: string; content?: string; engine?: string }[] };
    error?: { code: number; message: string };
  };

  if (json.error) {
    throw new Error(`Inner JSON-RPC error: ${json.error.code} ${json.error.message}`);
  }
  const results = json.result?.results || [];
  if (results.length === 0) {
    throw new Error("MCP-over-AXL round-trip succeeded but SearXNG returned 0 results — upstream may be misconfigured");
  }

  console.log(`  ✓ ${results.length} results in ${elapsed} ms`);
  console.log("  top 3:");
  for (const r of results.slice(0, 3)) {
    console.log(`    • ${r.title}`);
    console.log(`        ${r.url}`);
    if (r.engine) console.log(`        engine=${r.engine}`);
  }

  // Step 6 — write artifact.
  console.log("[6/6] Writing artifact...");
  if (!existsSync(ARTIFACTS_DIR)) mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const artifactPath = join(ARTIFACTS_DIR, "spike-20.json");
  const artifact = {
    spike: 20,
    name: "SearXNG retrieval over MCP-over-AXL",
    completedAt: new Date().toISOString(),
    elapsedMs: elapsed,
    transport: {
      caller: { axlNode: "axl-node-a", apiPort: NODE_A.apiPort },
      host: { axlNode: "axl-node-b", apiPort: NODE_B.apiPort, routerPort: ROUTER_PORT },
      hostPeerId,
      mcpUrl: `/mcp/${hostPeerId.slice(0, 16)}…/searxng`,
    },
    upstream: {
      searxngEndpoint: SEARXNG_ENDPOINT,
      query: QUERY,
      resultCount: results.length,
      topResults: results.slice(0, 5).map((r) => ({ title: r.title, url: r.url, engine: r.engine })),
    },
  };
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`  ✓ ${artifactPath}`);

  console.log("");
  console.log("Spike 20 PASS — SearXNG retrieval rode the AXL Yggdrasil mesh end-to-end");
  console.log("  caller → AXL TLS → host → router → SearXNG → real Google/Bing/etc results");

  killAll();
  // Let processes flush
  await new Promise((r) => setTimeout(r, 300));
  process.exit(0);
}

main().catch((err) => {
  console.error("Spike 20 FAIL:", err.message || err);
  killAll();
  setTimeout(() => process.exit(1), 300);
});
