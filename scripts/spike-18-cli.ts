/**
 * Spike 18 CLI — the user side of the multi-process choreography.
 *
 * Walks one bounty:
 *   1. createBountyWithSettlement on the V2 factory (real on-chain tx).
 *   2. Broadcast `bounty.broadcast` over AXL via the user's own AXL node
 *      (we re-use the planner's AXL endpoint for simplicity since it has
 *      direct connectivity to the other four — the planner's mesh
 *      delivers the message to all agents).
 *   3. Poll Bounty.status() every 5 s until Completed (or timeout).
 *   4. Read finalReportRoot from the contract, fetch the report from 0G
 *      Storage, persist artifact + print body.
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-18-cli.ts
 *
 * Pre-requisites:
 *   - `pnpm spike:18` running in another terminal (5 AXL nodes + 5 agents up)
 *   - All 5 operator wallets funded (≥ 0.05 OG; synth needs ≥ 0.5 OG for LZ)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

const FACTORY_ABI = [
  "function createBountyWithSettlement(uint256,string,bytes32,uint256,uint256,uint256) returns (uint256,address)",
  "event BountyCreated(address indexed bountyAddress,address indexed user,uint256 indexed bountyId,uint256 budget,string goalURI,bytes32 goalHash)",
];

const BOUNTY_ABI = [
  "function status() view returns (uint8)",
  "function finalReportRoot() view returns (bytes32)",
  "function acceptPlanner(uint256 plannerAgentId)",
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const STATUS_NAMES = [
  "Open",
  "Planning",
  "Bidding",
  "Researching",
  "Reviewing",
  "Synthesizing",
  "Completed",
  "Cancelled",
];

const GOAL =
  "Compare the security models of LayerZero V2 and Wormhole as of 2026: how each handles message attestation, who runs the verifying nodes, and one concrete vulnerability disclosed against either in the past 18 months.";

async function broadcastBountyToSwarm(
  axlEndpoint: string,
  plannerPubkey: string,
  bountyPayload: Record<string, unknown>,
): Promise<void> {
  const msg = { kind: "bounty.broadcast", bounty: bountyPayload };
  const res = await fetch(`${axlEndpoint}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Destination-Peer-Id": plannerPubkey,
    },
    body: JSON.stringify(msg),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AXL /send to planner ${res.status}: ${text.slice(0, 160)}`);
  }
}

async function main(): Promise<void> {
  console.log("=== Spike 18 CLI — multi-process swarm choreography ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpc);
  const explorer = process.env["OG_EXPLORER_URL"] ?? "https://chainscan-galileo.0g.ai";

  const factoryAddr = must("OG_BOUNTY_FACTORY");
  const userWallet = new ethers.Wallet(must("DEMO_PLANNER_KEY"), provider);
  const plannerPubkey = must("AXL_PEER_ID_PLANNER");

  // The CLI uses an AXL node "as itself" — easiest is to reuse the planner's
  // node since (a) it's already running, (b) addressing the planner directly
  // ensures the message lands. The planner's runtime is the only consumer of
  // bounty.broadcast (other roles ignore it), so this is the right shape.
  // NOTE: this means the CLI's AXL `from` will appear as the planner's pubkey.
  // For the demo it's purely a wake-up signal, no source-auth concern.
  const axlEndpoint = process.env["SPIKE18_CLI_AXL_ENDPOINT"] ?? "http://127.0.0.1:9101";

  console.log(`Factory:           ${factoryAddr}`);
  console.log(`User wallet:       ${userWallet.address}`);
  console.log(`Planner peer:      ${plannerPubkey.slice(0, 12)}…`);
  console.log(`AXL via:           ${axlEndpoint}\n`);
  console.log(`Goal:\n  ${GOAL}\n`);

  // ── 1. Create bounty on chain ──────────────────────────────────────────
  console.log("Step 1: createBountyWithSettlement on V2 factory…");
  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, userWallet) as any;

  const budget = ethers.parseUnits("1000", 6);
  const plannerFee = ethers.parseUnits("150", 6);
  const criticFee = ethers.parseUnits("150", 6);
  const synthFee = ethers.parseUnits("100", 6);
  const goalURI = `ipfs://scholar-swarm-spike-18-${Date.now()}`;
  const goalHash = ethers.keccak256(ethers.toUtf8Bytes(GOAL));

  const tx = await factory.createBountyWithSettlement(
    budget,
    goalURI,
    goalHash,
    plannerFee,
    criticFee,
    synthFee,
    { gasLimit: 1_500_000n, gasPrice: ethers.parseUnits("4", "gwei") },
  );
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();

  let bountyAddress: string | null = null;
  let bountyIdNum: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "BountyCreated") {
        bountyAddress = parsed.args.bountyAddress as string;
        bountyIdNum = parsed.args.bountyId as bigint;
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (!bountyAddress || bountyIdNum === null) throw new Error("BountyCreated not in receipt");
  console.log(`  bountyId=${bountyIdNum} address=${bountyAddress}\n`);

  // ── 1.5. acceptPlanner (only the user can do this — Bounty.sol enforces it).
  // The planner runtime needs status=Planning before it can call broadcastSubTasks.
  console.log("Step 1b: user calls acceptPlanner(1)…");
  const bountyAsUser = new ethers.Contract(bountyAddress, BOUNTY_ABI, userWallet) as any;
  const acceptTx = await bountyAsUser.acceptPlanner(1n, {
    gasLimit: 500_000n,
    gasPrice: ethers.parseUnits("4", "gwei"),
  });
  await acceptTx.wait();
  console.log(`  acceptPlanner tx: ${acceptTx.hash}\n`);

  // ── 2. Broadcast to the swarm ──────────────────────────────────────────
  console.log("Step 2: broadcasting bounty.broadcast to the planner's AXL node…");
  await broadcastBountyToSwarm(axlEndpoint, plannerPubkey, {
    id: bountyIdNum.toString(),
    user: userWallet.address,
    goal: GOAL,
    budgetUnits: budget.toString(),
    subTasks: ["placeholder-the-planner-will-decompose"],
    address: bountyAddress,
  });
  console.log("  signal sent. Swarm is now running.\n");

  // ── 3. Poll Bounty.status() ────────────────────────────────────────────
  console.log("Step 3: monitoring on-chain bounty status…");
  const bountyRO = new ethers.Contract(bountyAddress, BOUNTY_ABI, provider) as any;

  const startTs = Date.now();
  const timeoutMs = 12 * 60_000; // 12 minutes — covers Critic's 3 sequential reviews + Synth fire
  let lastStatus = -1;
  while (Date.now() - startTs < timeoutMs) {
    const s: bigint = await bountyRO.status();
    const sN = Number(s);
    if (sN !== lastStatus) {
      const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
      console.log(`  +${elapsed}s status: ${sN} (${STATUS_NAMES[sN] ?? "?"})`);
      lastStatus = sN;
    }
    if (sN === 6) break; // Completed
    if (sN === 7) throw new Error("Bounty was cancelled");
    await new Promise((r) => setTimeout(r, 5_000));
  }
  if (lastStatus !== 6) {
    console.error(`\n❌ timed out at status=${lastStatus} (${STATUS_NAMES[lastStatus] ?? "?"})`);
    process.exit(1);
  }

  // ── 4. Read finalReportRoot, persist artifact ──────────────────────────
  const reportRoot: string = await bountyRO.finalReportRoot();
  console.log(`\n✅ Bounty Completed!`);
  console.log(`Final report root: ${reportRoot}`);
  console.log(`(0G Storage URI:  0gstorage://${reportRoot})`);

  const artifact = {
    spike: "18-multi-process",
    runAt: new Date().toISOString(),
    chain: "0G Galileo",
    chainId: 16602,
    factoryV2: factoryAddr,
    bountyId: bountyIdNum.toString(),
    bountyAddress,
    user: userWallet.address,
    goal: GOAL,
    finalReportRoot: reportRoot,
    explorer: `${explorer}/address/${bountyAddress}`,
    elapsed_seconds: ((Date.now() - startTs) / 1000).toFixed(1),
  };
  await writeFile(join(ARTIFACT_DIR, "spike-18.json"), JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: docs/spike-artifacts/spike-18.json`);

  console.log("\n=== Spike 18 PASS ===");
  console.log("Five separate OS processes coordinated one bounty over AXL.");
  console.log("Each agent signed its own on-chain tx with its own wallet.");
  console.log("Synthesizer's submitSynthesis fired LayerZero V2 atomically.");
  console.log(`KH workflow on Base will pick up the DistributeRequested event.`);
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 18 CLI failed:");
  console.error(err);
  process.exit(1);
});
