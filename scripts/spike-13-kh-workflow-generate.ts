/**
 * Spike 13 — KeeperHub workflow generator: DistributeRequested → PaymentRouter.distribute
 *
 * Uses the KH MCP `ai_generate_workflow` tool to draft an event-driven workflow:
 *
 *   TRIGGER: PaymentMessenger emits `DistributeRequested(...)` on Base Sepolia
 *   ACTION:  decode the event payload and call PaymentRouter.distribute(bountyKey, recipients, amounts)
 *
 * The workflow is the canonical KH integration that closes the cross-chain loop:
 * after Synthesizer fires LZ V2 (Spike 12) and the Base side `PaymentMessenger`
 * emits DistributeRequested, KH watches that event and triggers the actual
 * USDC distribution via Direct Execution (gas + retry + audit).
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-13-kh-workflow-generate.ts
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

const WORKFLOW_DESCRIPTION = `
Create an event-driven workflow named "Scholar Swarm — Bounty Distribution" with these steps:

1. TRIGGER: Listen for the "DistributeRequested" event on the PaymentMessenger contract at address ${process.env["BASE_PAYMENT_MESSENGER"] ?? "0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4"} on Base Sepolia (network: base-sepolia, chain id 84532).

   Event signature:
     DistributeRequested(bytes32 indexed messageGuid, uint32 indexed srcEid, uint256 indexed bountyId, bytes32 srcSender, address[] recipients, uint256[] amounts)

2. ACTION: When the event fires, call the "distribute" function on the PaymentRouter contract at ${process.env["BASE_PAYMENT_ROUTER"] ?? "0xda6ab98bb73e75b2581b72c98f0891529eee2156"} on Base Sepolia.

   Function signature:
     distribute(bytes32 bountyKey, address[] recipients, uint256[] amounts)

   - bountyKey = keccak256-padded version of the bountyId from the event (or just bytes32(bountyId) if you can pass that)
   - recipients = recipients[] from the event (pass through unchanged)
   - amounts = amounts[] from the event (pass through unchanged)

3. RETRY: If the distribute call fails (e.g., insufficient escrow, gas estimation issue), retry up to 3 times with exponential backoff. Log each attempt to the audit trail.

The workflow closes the cross-chain payout loop: a LayerZero V2 message from 0G Galileo lands on Base, emits DistributeRequested, and this workflow turns it into an on-chain USDC payout via PaymentRouter.distribute. KeeperHub provides gas estimation, retry, and audit log.

Tag it: scholar-swarm, layerzero, payout, base-sepolia.
`;

async function main(): Promise<void> {
  console.log("=== Spike 13 — KeeperHub workflow draft via MCP ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const apiKey = must("KEEPERHUB_API_KEY");
  console.log(`API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`);

  const mcp = new KeeperHubMCPClient({ apiKey });
  await mcp.connect();
  console.log("MCP connected.\n");

  console.log("Step 1: ai_generate_workflow…");
  const generated = await mcp.aiGenerateWorkflow(WORKFLOW_DESCRIPTION);
  console.log(`  ok=${generated.ok}  isError=${generated.isError}`);
  const generatedJson = JSON.stringify(generated.content, null, 2);
  console.log(`  raw response (first 1000 chars):\n${generatedJson.slice(0, 1000)}\n`);

  // If KH supplied a workflowId or full workflow doc, persist it.
  let workflowId: string | undefined;
  let workflowName: string | undefined;
  try {
    const arr = generated.content as Array<{ type: string; text?: string }>;
    if (Array.isArray(arr) && arr[0]?.text) {
      const parsed = JSON.parse(arr[0].text);
      workflowId = parsed.workflowId ?? parsed.id ?? parsed.workflow?.id;
      workflowName = parsed.workflowName ?? parsed.name ?? parsed.workflow?.name;
    }
  } catch {
    /* response wasn't pure JSON; that's fine */
  }
  console.log(`  parsed workflowId: ${workflowId ?? "(not in response)"}`);
  console.log(`  parsed workflowName: ${workflowName ?? "(not in response)"}\n`);

  // Step 2: list workflows to confirm it landed.
  console.log("Step 2: list_workflows…");
  const list = await mcp.listWorkflows({ limit: 20 });
  console.log(`  ok=${list.ok}`);
  const wfList = JSON.stringify(list.content, null, 2);
  console.log(`  (first 500 chars)\n${wfList.slice(0, 500)}\n`);

  // Step 3: if we have a workflow id, fetch its full def.
  let workflowDef: unknown = null;
  if (workflowId) {
    console.log(`Step 3: get_workflow ${workflowId}…`);
    const def = await mcp.getWorkflow(workflowId);
    workflowDef = def.content;
    console.log(`  ok=${def.ok}\n`);
  } else {
    console.log("Step 3: skipped (no workflow id parsed from generation)\n");
  }

  await mcp.close();

  const artifact = {
    spike: "13-kh-workflow-generate",
    runAt: new Date().toISOString(),
    description: WORKFLOW_DESCRIPTION.trim(),
    generated: { ok: generated.ok, isError: generated.isError, content: generated.content },
    workflowId: workflowId ?? null,
    workflowName: workflowName ?? null,
    workflowDef,
    workflowsListAfter: list.content,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-13.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact: docs/spike-artifacts/spike-13.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`MCP connected:           ✅`);
  console.log(`ai_generate_workflow ok: ${generated.ok ? "✅" : "❌"}`);
  console.log(`Workflow id captured:    ${workflowId ? "✅" : "🟡 (response shape uncertain — check artifact)"}`);

  if (!generated.ok) {
    console.error("\n❌ Spike 13: KH did not generate a workflow.");
    process.exit(1);
  }
  console.log("\n✅ Spike 13 PASS — KeeperHub generated a workflow draft via MCP. See artifact for full def.");
  if (!workflowId) {
    console.log("   Note: workflow id wasn't auto-extracted; the response is in the artifact.");
    console.log("   May need to inspect manually or call create_workflow with the generated JSON.");
  }
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 13 failed:");
  console.error(err);
  process.exit(1);
});
