/**
 * Spike 14 — Create the KeeperHub workflow that closes the cross-chain payout loop.
 *
 * Reads the generated operations from spike-13, builds a workflow JSON, calls
 * `create_workflow` via MCP. Captures the resulting workflowId so we can wire
 * it into the demo.
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-14-kh-workflow-create.ts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { KeeperHubMCPClient } from "@scholar-swarm/keeperhub-client";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

interface KHNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; type: string; config: Record<string, unknown> };
}

interface KHEdge {
  id?: string;
  source: string;
  target: string;
}

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 14 — create KH workflow ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  // 1. Load spike-13 artifact
  const blob = await readFile(join(ARTIFACT_DIR, "spike-13.json"), "utf8");
  const spike13 = JSON.parse(blob);
  const generatedText = (spike13.generated.content as Array<{ type: string; text: string }>)[0]!.text;
  const inner = JSON.parse(generatedText) as { result: string };
  const lines = inner.result.split("\n").filter(Boolean);

  let name = "Scholar Swarm — Bounty Distribution";
  let description = "Automated USDC distribution after LayerZero V2 message lands on Base Sepolia";
  const nodes: KHNode[] = [];
  const edges: KHEdge[] = [];

  for (const line of lines) {
    try {
      const op = JSON.parse(line) as { operation: { op: string; [k: string]: unknown } };
      const o = op.operation;
      if (o.op === "setName") name = o["name"] as string;
      else if (o.op === "setDescription") description = o["description"] as string;
      else if (o.op === "addNode") nodes.push(o["node"] as KHNode);
      else if (o.op === "addEdge") edges.push(o["edge"] as KHEdge);
    } catch {
      /* skip malformed line */
    }
  }

  console.log(`Workflow: "${name}"`);
  console.log(`  description: ${description.slice(0, 100)}…`);
  console.log(`  nodes: ${nodes.length}  edges: ${edges.length}\n`);

  // Ensure edges have ids (KH may require)
  edges.forEach((e, i) => {
    if (!e.id) e.id = `edge-${i + 1}`;
  });

  // 2. Connect MCP and create
  const apiKey = must("KEEPERHUB_API_KEY");
  const mcp = new KeeperHubMCPClient({ apiKey });
  await mcp.connect();
  console.log("MCP connected.\n");

  console.log("Step 1: create_workflow…");
  const created = await mcp.callTool("create_workflow", { name, description, nodes, edges });
  console.log(`  ok=${created.ok}  isError=${created.isError}`);
  const createdJson = JSON.stringify(created.content, null, 2);
  console.log(`  raw response (first 800 chars):\n${createdJson.slice(0, 800)}\n`);

  // Try to parse a workflowId
  let workflowId: string | undefined;
  try {
    const arr = created.content as Array<{ type: string; text?: string }>;
    if (Array.isArray(arr) && arr[0]?.text) {
      const parsed = JSON.parse(arr[0].text);
      workflowId = parsed.id ?? parsed.workflowId ?? parsed.workflow?.id;
    }
  } catch {
    /* not JSON */
  }
  console.log(`  parsed workflowId: ${workflowId ?? "(not auto-parsed)"}\n`);

  // 3. Verify by listing
  console.log("Step 2: list_workflows (verify it landed)…");
  const list = await mcp.listWorkflows({ limit: 20 });
  console.log(`  ok=${list.ok}`);
  let found: { id: string; name: string } | null = null;
  try {
    const arr = list.content as Array<{ type: string; text?: string }>;
    if (Array.isArray(arr) && arr[0]?.text) {
      const wfs = JSON.parse(arr[0].text);
      found = wfs.find((w: { name: string }) => w.name === name) ?? null;
    }
  } catch {
    /* */
  }
  if (found) {
    console.log(`  ✓ found workflow "${found.name}" id=${found.id}\n`);
    workflowId = workflowId ?? found.id;
  } else {
    console.log(`  ⚠ workflow not in list yet — may need a moment, or response shape differs\n`);
  }

  await mcp.close();

  const artifact = {
    spike: "14-kh-workflow-create",
    runAt: new Date().toISOString(),
    workflowName: name,
    workflowDescription: description,
    workflowId: workflowId ?? null,
    nodesCount: nodes.length,
    edgesCount: edges.length,
    createResponse: created.content,
    listAfter: list.content,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-14.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact: docs/spike-artifacts/spike-14.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`create_workflow ok:  ${created.ok ? "✅" : "❌"}`);
  console.log(`Workflow listed:     ${found ? "✅" : "🟡"}`);
  console.log(`Workflow id:         ${workflowId ?? "(see artifact)"}`);

  if (!created.ok) {
    console.error("\n❌ create_workflow failed — see artifact for response. May need different argument shape.");
    process.exit(1);
  }
  console.log("\n✅ Spike 14 PASS — KH workflow live on the org.");
  if (workflowId) {
    console.log(`   Visit: https://app.keeperhub.com/workflows/${workflowId}`);
  }
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 14 failed:");
  console.error(err);
  process.exit(1);
});
