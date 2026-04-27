/**
 * Spike 8 — KeeperHub MCP server (Streamable HTTP transport)
 *
 * Connects to KH's hosted MCP server with our `kh_` API key, lists tools,
 * captures the schema for the ones we use. Proves the canonical MCP path
 * (vs. raw REST) works end-to-end.
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-08-keeperhub-mcp.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { KeeperHubMCPClient } from "@scholar-swarm/keeperhub-client";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 8 — KeeperHub MCP Streamable HTTP ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const apiKey = must("KEEPERHUB_API_KEY");
  console.log(`Using API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`);

  const mcp = new KeeperHubMCPClient({ apiKey });
  console.log(`Endpoint: https://app.keeperhub.com/mcp`);

  console.log("\nStep 1: connect + handshake…");
  await mcp.connect();
  console.log("  ✓ MCP session established");

  console.log("\nStep 2: list_tools…");
  const tools = await mcp.listTools();
  console.log(`  ✓ ${tools.length} tools advertised`);
  for (const t of tools) {
    const desc = t.description ? ` — ${t.description.slice(0, 60)}` : "";
    console.log(`    • ${t.name.padEnd(28)}${desc}`);
  }

  console.log("\nStep 3: call list_workflows…");
  const wfs = await mcp.listWorkflows({ limit: 5 });
  console.log(`  ok=${wfs.ok}  isError=${wfs.isError}`);
  console.log(`  content preview: ${JSON.stringify(wfs.content).slice(0, 240)}`);

  console.log("\nStep 4: call list_action_schemas…");
  const schemas = await mcp.listActionSchemas();
  console.log(`  ok=${schemas.ok}  isError=${schemas.isError}`);
  console.log(`  content preview: ${JSON.stringify(schemas.content).slice(0, 240)}`);

  const artifact = {
    spike: "08-keeperhub-mcp",
    runAt: new Date().toISOString(),
    endpoint: "https://app.keeperhub.com/mcp",
    transport: "streamable-http",
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
    listWorkflows: { ok: wfs.ok, isError: wfs.isError },
    listActionSchemas: { ok: schemas.ok, isError: schemas.isError },
  };
  await writeFile(join(ARTIFACT_DIR, "spike-08.json"), JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: docs/spike-artifacts/spike-08.json`);

  await mcp.close();

  console.log("\n=== Go/No-go Gate ===");
  const ok = tools.length > 0 && wfs.ok;
  console.log(`Tools listed: ${tools.length > 0 ? "✅" : "❌"}  (${tools.length})`);
  console.log(`Workflow read: ${wfs.ok ? "✅" : "❌"}`);
  console.log(`Action schemas read: ${schemas.ok ? "✅" : "⚠️"}`);

  if (!ok) {
    console.error("\n❌ KH MCP smoke failed — REST fallback still works but MCP integration weakens pitch.");
    process.exit(1);
  }
  console.log("\n✅ Spike 8 PASS — KH MCP roundtrip via Streamable HTTP confirmed.");
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 8 failed:");
  console.error(err);
  process.exit(1);
});
