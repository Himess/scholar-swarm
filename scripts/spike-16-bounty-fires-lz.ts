/**
 * Spike 16 — Bounty contract autonomously fires LayerZero V2 on synthesis (V2 factory).
 *
 * Same lifecycle as Spike 11, but using `BountyFactory.createBountyWithSettlement`
 * which wires `BountyMessenger` + role fees into the new clone via
 * `Bounty.configureSettlement`. On `submitSynthesis`, the bounty itself calls
 * `notifyCompletion` atomically — no manual operator step.
 *
 * What this proves for the submission:
 *   • The cross-chain payout request is on-chain logic, not a babysitter script.
 *   • Any synthesizer agent that owns its iNFT can ship the LZ message; no
 *     trusted relay sits in the path.
 *   • KH workflow (Spike 14, id `nepsavmovlyko0luy3rpi`) closes the loop on Base.
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-16-bounty-fires-lz.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

const FACTORY_ABI = [
  "function createBountyWithSettlement(uint256 budget,string goalURI,bytes32 goalHash,uint256 plannerFee,uint256 criticFee,uint256 synthesizerFee) returns (uint256 bountyId,address bountyAddress)",
  "function bountyMessenger() view returns (address)",
  "event BountyCreated(address indexed bountyAddress,address indexed user,uint256 indexed bountyId,uint256 budget,string goalURI,bytes32 goalHash)",
];

const BOUNTY_ABI = [
  "function status() view returns (uint8)",
  "function user() view returns (address)",
  "function plannerAgentId() view returns (uint256)",
  "function criticAgentId() view returns (uint256)",
  "function synthesizerAgentId() view returns (uint256)",
  "function finalReportRoot() view returns (bytes32)",
  "function bountyId() view returns (uint256)",
  "function bountyMessenger() view returns (address)",
  "function plannerFee() view returns (uint256)",
  "function criticFee() view returns (uint256)",
  "function synthesizerFee() view returns (uint256)",
  "function previewPayouts() view returns (address[] recipients,uint256[] amounts)",
  "function acceptPlanner(uint256 plannerAgentId_)",
  "function broadcastSubTasks(string[] descriptions)",
  "function placeBid(uint8 subTaskIndex,uint256 agentId,uint256 price,uint64 reputationSnapshot)",
  "function awardBid(uint8 subTaskIndex,uint256 agentId)",
  "function submitFindings(uint8 subTaskIndex,uint256 agentId,bytes32 findingsRoot)",
  "function reviewClaim(uint8 subTaskIndex,uint256 criticAgentId_,bool approved,string reasonURI)",
  "function submitSynthesis(uint256 synthesizerAgentId_,bytes32 reportRoot) payable",
  "event PayoutDispatched(bytes32 indexed lzGuid,uint64 nonce,uint256 lzFeePaid,address[] recipients,uint256[] amounts)",
  "event SettlementConfigured(address indexed messenger,uint256 indexed bountyId,uint256 plannerFee,uint256 criticFee,uint256 synthesizerFee)",
];

const MESSENGER_ABI = [
  "function quote(uint32 dstEid,uint256 bountyId,address[] recipients,uint256[] amounts,bytes extraOptions) view returns (tuple(uint256 nativeFee,uint256 lzTokenFee))",
  "function authorizedSenders(address) view returns (bool)",
  "function defaultDstEid() view returns (uint32)",
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const GAS_OPTS = { gasLimit: 1_500_000n, gasPrice: ethers.parseUnits("4", "gwei") };
// submitSynthesis + LZ V2 send is much heavier than ordinary state-machine txs.
const SYNTH_GAS_OPTS = { gasLimit: 3_500_000n, gasPrice: ethers.parseUnits("4", "gwei") };

async function logStatus(provider: ethers.JsonRpcProvider, addr: string): Promise<void> {
  const bounty = new ethers.Contract(addr, BOUNTY_ABI, provider) as any;
  const s: bigint = await bounty.status();
  const names = ["Open", "Planning", "Bidding", "Researching", "Reviewing", "Synthesizing", "Completed", "Cancelled"];
  console.log(`  → status: ${s} (${names[Number(s)] ?? "?"})`);
}

async function main(): Promise<void> {
  console.log("=== Spike 16 — Bounty fires LZ on synthesis (V2 factory) ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpc);
  const explorer = process.env["OG_EXPLORER_URL"] ?? "https://chainscan-galileo.0g.ai";
  const factoryAddr = must("OG_BOUNTY_FACTORY");
  const messengerAddr = must("OG_BOUNTY_MESSENGER");

  const userWallet = new ethers.Wallet(must("DEMO_PLANNER_KEY"), provider);
  const planner = new ethers.Wallet(must("PLANNER_OPERATOR_KEY"), provider);
  const r1 = new ethers.Wallet(must("RESEARCHER_1_OPERATOR_KEY"), provider);
  const r2 = new ethers.Wallet(must("RESEARCHER_2_OPERATOR_KEY"), provider);
  const critic = new ethers.Wallet(must("CRITIC_OPERATOR_KEY"), provider);
  const synth = new ethers.Wallet(must("SYNTHESIZER_OPERATOR_KEY"), provider);

  console.log(`Factory (V2)  : ${factoryAddr}`);
  console.log(`Messenger     : ${messengerAddr}`);
  console.log(`User          : ${userWallet.address}`);
  console.log(`Planner #1    : ${planner.address}`);
  console.log(`R1 #2         : ${r1.address}`);
  console.log(`R2 #3         : ${r2.address}`);
  console.log(`Critic #4     : ${critic.address}`);
  console.log(`Synth #5      : ${synth.address}\n`);

  // Sanity: factory has messenger wired
  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, userWallet) as any;
  const wiredMessenger: string = await factory.bountyMessenger();
  if (wiredMessenger.toLowerCase() !== messengerAddr.toLowerCase()) {
    throw new Error(`factory.bountyMessenger=${wiredMessenger} ≠ env=${messengerAddr}`);
  }
  console.log("✓ factory.bountyMessenger matches env\n");

  // ── Step 1: createBountyWithSettlement ──────────────────────────────────
  console.log("Step 1: User creates bounty WITH settlement…");
  const budget = ethers.parseUnits("1000", 6);
  const plannerFee = ethers.parseUnits("150", 6);
  const criticFee = ethers.parseUnits("150", 6);
  const synthFee = ethers.parseUnits("100", 6);
  const goalURI = `ipfs://scholar-swarm-spike-16-${Date.now()}`;
  const goalHash = ethers.keccak256(
    ethers.toUtf8Bytes("Day 7: end-to-end E2E with auto-LZ-fire on synthesis"),
  );

  const createTx = await factory.createBountyWithSettlement(
    budget,
    goalURI,
    goalHash,
    plannerFee,
    criticFee,
    synthFee,
    GAS_OPTS,
  );
  console.log(`  createBountyWithSettlement tx: ${createTx.hash}`);
  const createReceipt = await createTx.wait();

  let bountyAddress: string | null = null;
  let bountyIdNum: bigint | null = null;
  for (const log of createReceipt.logs) {
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
  if (!bountyAddress || bountyIdNum === null) throw new Error("BountyCreated not found");
  console.log(`  bountyId: ${bountyIdNum}  address: ${bountyAddress}\n`);

  // Sanity: settlement is configured
  const bountyRead = new ethers.Contract(bountyAddress, BOUNTY_ABI, provider) as any;
  const wMessenger: string = await bountyRead.bountyMessenger();
  const wPlannerFee: bigint = await bountyRead.plannerFee();
  const wCriticFee: bigint = await bountyRead.criticFee();
  const wSynthFee: bigint = await bountyRead.synthesizerFee();
  console.log(`  bounty.bountyMessenger = ${wMessenger}`);
  console.log(`  bounty.plannerFee      = ${ethers.formatUnits(wPlannerFee, 6)} USDC`);
  console.log(`  bounty.criticFee       = ${ethers.formatUnits(wCriticFee, 6)} USDC`);
  console.log(`  bounty.synthesizerFee  = ${ethers.formatUnits(wSynthFee, 6)} USDC`);

  // Sanity: bounty is authorized on the messenger
  const messengerRead = new ethers.Contract(messengerAddr, MESSENGER_ABI, provider) as any;
  const isAuth: boolean = await messengerRead.authorizedSenders(bountyAddress);
  console.log(`  messenger.authorizedSenders[bounty] = ${isAuth} ${isAuth ? "✅" : "❌"}\n`);
  if (!isAuth) throw new Error("bounty not authorized on messenger — factory wiring broken");

  const txs: { step: string; hash: string }[] = [{ step: "1.createBountyWithSettlement", hash: createTx.hash }];

  // ── Step 2: acceptPlanner ───────────────────────────────────────────────
  console.log("Step 2: User accepts planner agentId=1…");
  const bountyAsUser = new ethers.Contract(bountyAddress, BOUNTY_ABI, userWallet) as any;
  const acceptTx = await bountyAsUser.acceptPlanner(1n, GAS_OPTS);
  await acceptTx.wait();
  txs.push({ step: "2.acceptPlanner", hash: acceptTx.hash });
  await logStatus(provider, bountyAddress);

  // ── Step 3: broadcastSubTasks ───────────────────────────────────────────
  console.log("\nStep 3: Planner broadcasts 3 sub-tasks…");
  const bountyAsPlanner = new ethers.Contract(bountyAddress, BOUNTY_ABI, planner) as any;
  const subTasks = [
    "Stargate AI: 5+ direct competitors and funding/products",
    "Stargate AI: technology moat (data, compute, IP) — concrete artifacts",
    "Stargate AI: financial health and key risks (regulatory, technical, geopolitical)",
  ];
  const broadcastTx = await bountyAsPlanner.broadcastSubTasks(subTasks, GAS_OPTS);
  await broadcastTx.wait();
  txs.push({ step: "3.broadcastSubTasks", hash: broadcastTx.hash });
  await logStatus(provider, bountyAddress);

  // ── Step 4: bids ────────────────────────────────────────────────────────
  console.log("\nStep 4: Researchers place bids (R1 t0,t2 ; R2 t1)…");
  const bountyAsR1 = new ethers.Contract(bountyAddress, BOUNTY_ABI, r1) as any;
  const bountyAsR2 = new ethers.Contract(bountyAddress, BOUNTY_ABI, r2) as any;
  const subTaskBidPrice = ethers.parseUnits("200", 6);

  const b1 = await bountyAsR1.placeBid(0, 2n, subTaskBidPrice, 12, GAS_OPTS);
  await b1.wait();
  txs.push({ step: "4.bidR1-t0", hash: b1.hash });
  const b2 = await bountyAsR2.placeBid(1, 3n, subTaskBidPrice, 4, GAS_OPTS);
  await b2.wait();
  txs.push({ step: "4.bidR2-t1", hash: b2.hash });
  const b3 = await bountyAsR1.placeBid(2, 2n, subTaskBidPrice, 12, GAS_OPTS);
  await b3.wait();
  txs.push({ step: "4.bidR1-t2", hash: b3.hash });

  // ── Step 5: awards ──────────────────────────────────────────────────────
  console.log("\nStep 5: Planner awards bids…");
  for (const [idx, agentId] of [
    [0, 2n],
    [1, 3n],
    [2, 2n],
  ] as const) {
    const t = await bountyAsPlanner.awardBid(idx, agentId, GAS_OPTS);
    await t.wait();
    txs.push({ step: `5.award-t${idx}`, hash: t.hash });
  }
  await logStatus(provider, bountyAddress);

  // ── Step 6: findings ────────────────────────────────────────────────────
  console.log("\nStep 6: Researchers submit findings…");
  const findingsRoots = [
    ethers.keccak256(ethers.toUtf8Bytes("findings-task-0-spike-16")),
    ethers.keccak256(ethers.toUtf8Bytes("findings-task-1-spike-16")),
    ethers.keccak256(ethers.toUtf8Bytes("findings-task-2-spike-16")),
  ];
  const f0 = await bountyAsR1.submitFindings(0, 2n, findingsRoots[0], GAS_OPTS);
  await f0.wait();
  txs.push({ step: "6.findings-t0", hash: f0.hash });
  const f1 = await bountyAsR2.submitFindings(1, 3n, findingsRoots[1], GAS_OPTS);
  await f1.wait();
  txs.push({ step: "6.findings-t1", hash: f1.hash });
  const f2 = await bountyAsR1.submitFindings(2, 2n, findingsRoots[2], GAS_OPTS);
  await f2.wait();
  txs.push({ step: "6.findings-t2", hash: f2.hash });
  await logStatus(provider, bountyAddress);

  // ── Step 7: critic ──────────────────────────────────────────────────────
  console.log("\nStep 7: Critic approves all 3 sub-tasks…");
  const bountyAsCritic = new ethers.Contract(bountyAddress, BOUNTY_ABI, critic) as any;
  for (const idx of [0, 1, 2]) {
    const t = await bountyAsCritic.reviewClaim(idx, 4n, true, `0gstorage://critic-rationale-${idx}`, GAS_OPTS);
    await t.wait();
    txs.push({ step: `7.review-t${idx}`, hash: t.hash });
  }
  await logStatus(provider, bountyAddress);

  // ── Step 8: preview payouts + quote LZ fee ──────────────────────────────
  console.log("\nStep 8: previewPayouts + quote LZ fee…");
  // ethers v6 returns a frozen Result; copy into plain arrays before passing
  // to another call (otherwise "Cannot assign to read only property '0'").
  const previewRaw = await bountyRead.previewPayouts();
  const recipientsPreview: string[] = Array.from(previewRaw[0] ?? previewRaw.recipients);
  const amountsPreview: bigint[] = Array.from(previewRaw[1] ?? previewRaw.amounts).map((x: bigint) => BigInt(x));

  // previewPayouts is called BEFORE submitSynthesis, so synthesizerAgentId == 0
  // and the synth entry is not in the preview. Inside submitSynthesis the synth
  // is added, so the actual broadcast has 1 more entry. Add it here for quote.
  const recipientsQuote: string[] = [...recipientsPreview, synth.address];
  const amountsQuote: bigint[] = [...amountsPreview, synthFee];

  console.log("  Final payout vector (with synth, what the messenger will broadcast):");
  for (let i = 0; i < recipientsQuote.length; ++i) {
    console.log(`    [${i}] ${recipientsQuote[i]}  ${ethers.formatUnits(amountsQuote[i], 6)} USDC`);
  }

  const messenger = new ethers.Contract(messengerAddr, MESSENGER_ABI, provider) as any;
  const fee: { nativeFee: bigint; lzTokenFee: bigint } = await messenger.quote(
    0,
    bountyIdNum,
    recipientsQuote,
    amountsQuote,
    "0x",
  );
  console.log(`  LZ native fee: ${ethers.formatEther(fee.nativeFee)} OG`);
  // OApp._payNative is strict: msg.value MUST equal nativeFee exactly. Any
  // buffer triggers NotEnoughNative; any underpay reverts too. So we send
  // the quoted amount as-is. (Slight price drift between quote and send is
  // accepted by the synth; if it does revert, retry by re-quoting.)
  const lzFee = fee.nativeFee;
  console.log(`  Sending with msg.value = ${ethers.formatEther(lzFee)} OG (exact, no buffer)\n`);

  // ── Step 9: submitSynthesis (auto-fires LZ) ─────────────────────────────
  console.log("Step 9: Synthesizer submits synthesis (msg.value = LZ fee)…");
  const bountyAsSynth = new ethers.Contract(bountyAddress, BOUNTY_ABI, synth) as any;
  const reportRoot = ethers.keccak256(ethers.toUtf8Bytes(`final-report-spike-16-${Date.now()}`));
  const synthTx = await bountyAsSynth.submitSynthesis(5n, reportRoot, { ...SYNTH_GAS_OPTS, value: lzFee });
  console.log(`  submitSynthesis tx: ${synthTx.hash}`);
  const synthReceipt = await synthTx.wait();
  txs.push({ step: "9.submitSynthesis-firesLZ", hash: synthTx.hash });

  // Parse PayoutDispatched event for the LZ GUID
  let lzGuid: string | null = null;
  let lzNonce: bigint | null = null;
  let dispatchedRecipients: string[] | null = null;
  let dispatchedAmounts: bigint[] | null = null;
  const bountyIface = new ethers.Interface(BOUNTY_ABI);
  for (const log of synthReceipt.logs) {
    try {
      const parsed = bountyIface.parseLog(log);
      if (parsed?.name === "PayoutDispatched") {
        lzGuid = parsed.args.lzGuid as string;
        lzNonce = parsed.args.nonce as bigint;
        dispatchedRecipients = parsed.args.recipients as string[];
        dispatchedAmounts = parsed.args.amounts as bigint[];
        break;
      }
    } catch {
      /* skip */
    }
  }

  await logStatus(provider, bountyAddress);

  console.log("\n=== Cross-chain payout dispatch ===");
  console.log(`LZ GUID:   ${lzGuid ?? "(not parsed)"}`);
  console.log(`LZ nonce:  ${lzNonce ?? "(not parsed)"}`);
  console.log(`Recipients: ${dispatchedRecipients?.length ?? 0}`);
  if (lzGuid) {
    console.log(`LayerZero scan: https://testnet.layerzeroscan.com/tx/${synthTx.hash}`);
  }

  const artifact = {
    spike: "16-bounty-fires-lz",
    runAt: new Date().toISOString(),
    chain: "0G Galileo",
    chainId: 16602,
    factoryV2: factoryAddr,
    messenger: messengerAddr,
    bountyId: bountyIdNum.toString(),
    bountyAddress,
    fees: {
      planner: plannerFee.toString(),
      critic: criticFee.toString(),
      synthesizer: synthFee.toString(),
      researcherPerSubTask: subTaskBidPrice.toString(),
    },
    payouts: {
      recipients: recipientsQuote,
      amounts: amountsQuote.map((a: bigint) => a.toString()),
      dispatched: dispatchedRecipients
        ? dispatchedRecipients.map((addr, i) => ({
            recipient: addr,
            amount: dispatchedAmounts?.[i]?.toString() ?? null,
          }))
        : null,
    },
    lz: {
      quoteFeeNative: fee.nativeFee.toString(),
      sentMsgValue: lzFee.toString(),
      guid: lzGuid,
      nonce: lzNonce?.toString() ?? null,
      synthTx: synthTx.hash,
      lzScan: lzGuid ? `https://testnet.layerzeroscan.com/tx/${synthTx.hash}` : null,
    },
    txs: txs.map((t) => ({ ...t, explorer: `${explorer}/tx/${t.hash}` })),
  };
  await writeFile(join(ARTIFACT_DIR, "spike-16.json"), JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: docs/spike-artifacts/spike-16.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`Bounty status Completed:    ${(await bountyRead.status()) === 6n ? "✅" : "❌"}`);
  console.log(`PayoutDispatched event:     ${lzGuid ? "✅" : "❌"}`);
  console.log(`LZ GUID captured:           ${lzGuid ?? "(none)"}`);
  console.log(`Bounty authorized on msgr:  ${isAuth ? "✅" : "❌"}`);

  if (!lzGuid) {
    console.error("\n❌ Spike 16 FAIL — synthesis succeeded but PayoutDispatched not emitted.");
    process.exit(1);
  }
  console.log("\n✅ Spike 16 PASS — Bounty atomically fires LZ on synthesis. Loop closes via KH workflow on Base.");
  console.log(`   Wait ~30-60s, then check Base PaymentMessenger for DistributeRequested with this GUID.`);
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 16 failed:");
  console.error(err);
  process.exit(1);
});
