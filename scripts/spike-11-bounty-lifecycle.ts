/**
 * Spike 11 — full Bounty lifecycle on 0G Galileo, end-to-end with real signers.
 *
 * Walks every state transition of Bounty.sol using the real operator wallets
 * (each role signed by its own wallet — proves the "different operators"
 * narrative on-chain), then captures every tx for the demo video.
 *
 * Sequence:
 *   1. User       → BountyFactory.createBounty                    Open
 *   2. User       → Bounty.acceptPlanner(plannerAgentId)          Open    → Planning
 *   3. Planner    → Bounty.broadcastSubTasks([3 strings])         Planning → Bidding
 *   4. R1, R2     → Bounty.placeBid each on sub-tasks
 *   5. Planner    → Bounty.awardBid each sub-task                 Bidding  → Researching (after all 3)
 *   6. R-winners  → Bounty.submitFindings (storageRoot stub)      Researching → Reviewing
 *   7. Critic     → Bounty.reviewClaim true × 3                   Reviewing → Synthesizing
 *   8. Synth      → Bounty.submitSynthesis(reportRoot)            Synthesizing → Completed
 *   9. (next spike) Synth fires BountyMessenger.notifyCompletion to Base.
 *
 * Outputs an artifact with bountyAddress + every tx hash + final on-chain state.
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-11-bounty-lifecycle.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

// ── Minimal ABIs we need ────────────────────────────────────────────────────
const FACTORY_ABI = [
  "function createBounty(uint256 budget,string goalURI,bytes32 goalHash) returns (uint256 bountyId,address bountyAddress)",
  "event BountyCreated(address indexed bountyAddress,address indexed user,uint256 indexed bountyId,uint256 budget,string goalURI,bytes32 goalHash)",
];

const BOUNTY_ABI = [
  "function status() view returns (uint8)",
  "function user() view returns (address)",
  "function plannerAgentId() view returns (uint256)",
  "function criticAgentId() view returns (uint256)",
  "function synthesizerAgentId() view returns (uint256)",
  "function finalReportRoot() view returns (bytes32)",
  "function acceptPlanner(uint256 plannerAgentId_)",
  "function broadcastSubTasks(string[] descriptions)",
  "function placeBid(uint8 subTaskIndex,uint256 agentId,uint256 price,uint64 reputationSnapshot)",
  "function awardBid(uint8 subTaskIndex,uint256 agentId)",
  "function submitFindings(uint8 subTaskIndex,uint256 agentId,bytes32 findingsRoot)",
  "function reviewClaim(uint8 subTaskIndex,uint256 criticAgentId_,bool approved,string reasonURI)",
  "function submitSynthesis(uint256 synthesizerAgentId_,bytes32 reportRoot)",
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const GAS_OPTS = { gasLimit: 1_000_000n, gasPrice: ethers.parseUnits("4", "gwei") };

async function main(): Promise<void> {
  console.log("=== Spike 11 — Bounty lifecycle E2E on 0G Galileo ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpc);
  const explorer = process.env["OG_EXPLORER_URL"] ?? "https://chainscan-galileo.0g.ai";
  const factoryAddr = must("OG_BOUNTY_FACTORY");

  // ── Wallets ────────────────────────────────────────────────────────────
  const userWallet = new ethers.Wallet(must("DEMO_PLANNER_KEY"), provider);
  const planner = new ethers.Wallet(must("PLANNER_OPERATOR_KEY"), provider);
  const r1 = new ethers.Wallet(must("RESEARCHER_1_OPERATOR_KEY"), provider);
  const r2 = new ethers.Wallet(must("RESEARCHER_2_OPERATOR_KEY"), provider);
  const critic = new ethers.Wallet(must("CRITIC_OPERATOR_KEY"), provider);
  const synth = new ethers.Wallet(must("SYNTHESIZER_OPERATOR_KEY"), provider);

  console.log(`User       : ${userWallet.address}`);
  console.log(`Planner #1 : ${planner.address}`);
  console.log(`R1 #2      : ${r1.address}`);
  console.log(`R2 #3      : ${r2.address}`);
  console.log(`Critic #4  : ${critic.address}`);
  console.log(`Synth #5   : ${synth.address}\n`);

  // ── Sanity: balances ───────────────────────────────────────────────────
  for (const [name, w] of [
    ["User", userWallet],
    ["Planner", planner],
    ["R1", r1],
    ["R2", r2],
    ["Critic", critic],
    ["Synth", synth],
  ] as const) {
    const bal = await provider.getBalance(w.address);
    console.log(`  ${name.padEnd(8)} balance: ${ethers.formatEther(bal)} OG`);
  }
  console.log();

  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, userWallet) as any;

  // ── 1. Create bounty ──────────────────────────────────────────────────
  console.log("Step 1: User creates bounty…");
  const budget = ethers.parseUnits("1000", 6); // 1000 USDC raw (6 dec) — informational on 0G
  const goalURI = `ipfs://scholar-swarm-spike-11-${Date.now()}`;
  const goalHash = ethers.keccak256(ethers.toUtf8Bytes("Analyze the Stargate AI project — competitors, tech moat, financial health, risks"));

  const createTx = await factory.createBounty(budget, goalURI, goalHash, GAS_OPTS);
  console.log(`  createBounty tx: ${createTx.hash}`);
  const createReceipt = await createTx.wait();

  let bountyAddress: string | null = null;
  let bountyId: bigint | null = null;
  for (const log of createReceipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "BountyCreated") {
        bountyAddress = parsed.args.bountyAddress as string;
        bountyId = parsed.args.bountyId as bigint;
        break;
      }
    } catch {
      /* not factory log */
    }
  }
  if (!bountyAddress) throw new Error("BountyCreated event not found");
  console.log(`  bountyId: ${bountyId}  address: ${bountyAddress}\n`);

  const txs: { step: string; hash: string }[] = [{ step: "1.createBounty", hash: createTx.hash }];

  // ── 2. acceptPlanner (User signs) ─────────────────────────────────────
  console.log("Step 2: User accepts planner agentId=1…");
  const bountyAsUser = new ethers.Contract(bountyAddress, BOUNTY_ABI, userWallet) as any;
  const acceptTx = await bountyAsUser.acceptPlanner(1n, GAS_OPTS);
  console.log(`  acceptPlanner tx: ${acceptTx.hash}`);
  await acceptTx.wait();
  txs.push({ step: "2.acceptPlanner", hash: acceptTx.hash });
  await logStatus(provider, bountyAddress);

  // ── 3. broadcastSubTasks (Planner signs) ──────────────────────────────
  console.log("\nStep 3: Planner broadcasts 3 sub-tasks…");
  const bountyAsPlanner = new ethers.Contract(bountyAddress, BOUNTY_ABI, planner) as any;
  const subTasks = [
    "Stargate AI: list of 5+ direct competitors and their funding/products",
    "Stargate AI: technology moat (data, compute, partnerships, IP) — concrete artifacts",
    "Stargate AI: financial health and key risks (regulatory, technical, geopolitical)",
  ];
  const broadcastTx = await bountyAsPlanner.broadcastSubTasks(subTasks, GAS_OPTS);
  console.log(`  broadcastSubTasks tx: ${broadcastTx.hash}`);
  await broadcastTx.wait();
  txs.push({ step: "3.broadcastSubTasks", hash: broadcastTx.hash });
  await logStatus(provider, bountyAddress);

  // ── 4. Bids (R1 on tasks 0+2, R2 on task 1) ───────────────────────────
  // Serialized — same wallet bidding twice cannot be parallel (nonce clash).
  console.log("\nStep 4: Researchers place bids…");
  const bountyAsR1 = new ethers.Contract(bountyAddress, BOUNTY_ABI, r1) as any;
  const bountyAsR2 = new ethers.Contract(bountyAddress, BOUNTY_ABI, r2) as any;
  const subTaskBidPrice = ethers.parseUnits("200", 6); // 200 USDC each

  const bid1 = await bountyAsR1.placeBid(0, 2n, subTaskBidPrice, 12, GAS_OPTS);
  await bid1.wait();
  console.log(`  R1 bid task 0: ${bid1.hash}`);
  txs.push({ step: "4.bidR1-t0", hash: bid1.hash });

  const bid2 = await bountyAsR2.placeBid(1, 3n, subTaskBidPrice, 4, GAS_OPTS);
  await bid2.wait();
  console.log(`  R2 bid task 1: ${bid2.hash}`);
  txs.push({ step: "4.bidR2-t1", hash: bid2.hash });

  const bid3 = await bountyAsR1.placeBid(2, 2n, subTaskBidPrice, 12, GAS_OPTS);
  await bid3.wait();
  console.log(`  R1 bid task 2: ${bid3.hash}`);
  txs.push({ step: "4.bidR1-t2", hash: bid3.hash });

  // ── 5. Awards (Planner) ───────────────────────────────────────────────
  console.log("\nStep 5: Planner awards bids…");
  for (const [idx, agentId] of [
    [0, 2n],
    [1, 3n],
    [2, 2n],
  ] as const) {
    const t = await bountyAsPlanner.awardBid(idx, agentId, GAS_OPTS);
    await t.wait();
    console.log(`  award task ${idx} → agent ${agentId}: ${t.hash}`);
    txs.push({ step: `5.award-t${idx}`, hash: t.hash });
  }
  await logStatus(provider, bountyAddress);

  // ── 6. Submit findings (R-winners) ────────────────────────────────────
  console.log("\nStep 6: Researchers submit findings…");
  const findingsRoots = [
    ethers.keccak256(ethers.toUtf8Bytes("findings-task-0-competitors")),
    ethers.keccak256(ethers.toUtf8Bytes("findings-task-1-tech-moat")),
    ethers.keccak256(ethers.toUtf8Bytes("findings-task-2-risks")),
  ];

  const t60 = await bountyAsR1.submitFindings(0, 2n, findingsRoots[0], GAS_OPTS);
  await t60.wait();
  console.log(`  R1 findings task 0: ${t60.hash}`);
  txs.push({ step: "6.findings-t0", hash: t60.hash });

  const t61 = await bountyAsR2.submitFindings(1, 3n, findingsRoots[1], GAS_OPTS);
  await t61.wait();
  console.log(`  R2 findings task 1: ${t61.hash}`);
  txs.push({ step: "6.findings-t1", hash: t61.hash });

  const t62 = await bountyAsR1.submitFindings(2, 2n, findingsRoots[2], GAS_OPTS);
  await t62.wait();
  console.log(`  R1 findings task 2: ${t62.hash}`);
  txs.push({ step: "6.findings-t2", hash: t62.hash });
  await logStatus(provider, bountyAddress);

  // ── 7. Critic reviews ─────────────────────────────────────────────────
  console.log("\nStep 7: Critic approves all 3 sub-tasks…");
  const bountyAsCritic = new ethers.Contract(bountyAddress, BOUNTY_ABI, critic) as any;
  for (const idx of [0, 1, 2]) {
    const t = await bountyAsCritic.reviewClaim(
      idx,
      4n,
      true,
      `0gstorage://critic-rationale-task-${idx}`,
      GAS_OPTS,
    );
    await t.wait();
    console.log(`  critic approve task ${idx}: ${t.hash}`);
    txs.push({ step: `7.review-t${idx}`, hash: t.hash });
  }
  await logStatus(provider, bountyAddress);

  // ── 8. Synthesizer submits synthesis ──────────────────────────────────
  console.log("\nStep 8: Synthesizer submits synthesis report…");
  const bountyAsSynth = new ethers.Contract(bountyAddress, BOUNTY_ABI, synth) as any;
  const reportRoot = ethers.keccak256(ethers.toUtf8Bytes("final-report-stargate-ai-v1"));
  const synthTx = await bountyAsSynth.submitSynthesis(5n, reportRoot, GAS_OPTS);
  await synthTx.wait();
  console.log(`  submitSynthesis tx: ${synthTx.hash}`);
  txs.push({ step: "8.submitSynthesis", hash: synthTx.hash });
  await logStatus(provider, bountyAddress);

  // ── Final state ───────────────────────────────────────────────────────
  const bountyRead = new ethers.Contract(bountyAddress, BOUNTY_ABI, provider) as any;
  const finalStatus: bigint = await bountyRead.status();
  const finalReportRoot: string = await bountyRead.finalReportRoot();
  console.log(`\nFinal status: ${finalStatus} (expected 6 = Completed)`);
  console.log(`Final report root: ${finalReportRoot}`);

  const artifact = {
    spike: "11-bounty-lifecycle-e2e",
    runAt: new Date().toISOString(),
    chain: "0G Galileo",
    chainId: 16602,
    bountyId: bountyId!.toString(),
    bountyAddress,
    finalStatus: finalStatus.toString(),
    finalReportRoot,
    txs: txs.map((t) => ({ ...t, explorer: `${explorer}/tx/${t.hash}` })),
  };
  await writeFile(join(ARTIFACT_DIR, "spike-11.json"), JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: docs/spike-artifacts/spike-11.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`Total txs:           ${txs.length}`);
  console.log(`Final status = 6:    ${finalStatus === 6n ? "✅" : "❌"}`);
  console.log(`Report root set:     ${finalReportRoot !== ethers.ZeroHash ? "✅" : "❌"}`);

  if (finalStatus !== 6n) {
    console.error("\n❌ Bounty did not reach Completed.");
    process.exit(1);
  }
  console.log(`\n✅ Spike 11 PASS — full bounty lifecycle landed on-chain. ${txs.length} txs, six different signers.`);
  console.log(`   Next: Synthesizer fires BountyMessenger.notifyCompletion (LZ → Base) — Spike 12.`);
}

async function logStatus(provider: ethers.JsonRpcProvider, bountyAddr: string): Promise<void> {
  const bounty = new ethers.Contract(bountyAddr, BOUNTY_ABI, provider) as any;
  const s: bigint = await bounty.status();
  const names = ["Open", "Planning", "Bidding", "Researching", "Reviewing", "Synthesizing", "Completed", "Cancelled"];
  console.log(`    → status: ${names[Number(s)]} (${s})`);
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 11 failed:");
  console.error(err);
  process.exit(1);
});
