/**
 * Spike 19 — Real USDC end-to-end payout via KeeperHub Direct Execution.
 *
 * Closes the cross-chain demo gap: until now PaymentRouter.distribute() had
 * never moved real value. This spike funds the escrow with real Circle USDC
 * (Base Sepolia 0x036CbD…) and triggers the KH Direct Execution API to call
 * `distribute()` on the keeper's behalf, splitting the funds across the 5
 * Scholar Swarm operator wallets per the same fee schedule Bounty.sol uses.
 *
 * Why KH Direct Execution and not setKeeper(deployer) shortcut?
 * Because the production payout path goes:
 *
 *     0G Bounty.submitSynthesis ──LZ V2──► Base PaymentMessenger
 *           ──DistributeRequested event──► KeeperHub workflow
 *                ──KH Para wallet signs──► PaymentRouter.distribute()
 *
 * Spike 19 exercises the bottom half of that path with real money flowing.
 * (The top half is exercised by Spike 9 + Spike 12; Spike 18 chains them.)
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-19-real-usdc-payout.ts
 *
 * Env required:
 *   DEMO_PLANNER_KEY               — funds the escrow (also our Base deployer)
 *   BASE_SEPOLIA_RPC               — defaults to https://sepolia.base.org
 *   BASE_SEPOLIA_USDC              — 0x036CbD53…
 *   BASE_PAYMENT_ROUTER            — 0xda6ab98b…
 *   KEEPERHUB_API_KEY              — kh_…
 *   KEEPERHUB_ENDPOINT             — defaults to https://app.keeperhub.com/api
 *   {PLANNER,RESEARCHER_1,RESEARCHER_2,CRITIC,SYNTHESIZER}_OPERATOR_WALLET
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");
const BASESCAN = "https://sepolia.basescan.org";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const ROUTER_ABI = [
  "function fund(bytes32 bountyKey, uint256 amount)",
  "function escrow(bytes32 bountyKey) view returns (tuple(address user, uint256 totalAmount, uint8 status, uint64 createdAt, uint64 settledAt))",
  "function token() view returns (address)",
  "function keeper() view returns (address)",
];

const DISTRIBUTE_ABI_FRAGMENT = [
  {
    type: "function",
    name: "distribute",
    inputs: [
      { name: "bountyKey", type: "bytes32" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const ESCROW_STATUS_NAMES = ["None", "Funded", "Distributed", "Refunded"];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

interface Recipient {
  label: string;
  address: string;
  /** USDC base units (6 decimals). */
  amountUnits: bigint;
}

interface KhExecuteResponse {
  executionId?: string;
  id?: string;
  status?: string;
  txHash?: string;
  transactionHash?: string;
}

async function khTriggerDistribute(
  endpoint: string,
  apiKey: string,
  router: string,
  bountyKey: string,
  recipients: string[],
  amounts: string[],
): Promise<{ executionId: string; raw: unknown }> {
  const body = {
    contractAddress: router,
    network: "base-sepolia",
    functionName: "distribute",
    functionArgs: JSON.stringify([bountyKey, recipients, amounts]),
    abi: JSON.stringify(DISTRIBUTE_ABI_FRAGMENT),
    value: "0",
    gasLimitMultiplier: "1.3",
  };
  const res = await fetch(`${endpoint}/execute/contract-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 202) {
    throw new Error(`KH execute ${res.status}: ${text.slice(0, 400)}`);
  }
  let parsed: KhExecuteResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`KH execute non-JSON response: ${text.slice(0, 200)}`);
  }
  const id = parsed.executionId ?? parsed.id;
  if (!id) throw new Error(`KH execute response had no executionId: ${text.slice(0, 200)}`);
  return { executionId: id, raw: parsed };
}

async function khPollExecution(
  endpoint: string,
  apiKey: string,
  executionId: string,
  timeoutMs = 180_000,
): Promise<{ status: string; raw: unknown }> {
  const start = Date.now();
  let lastRaw: unknown = null;
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${endpoint}/execute/${executionId}/status`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`KH status ${res.status}: ${text.slice(0, 200)}`);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`KH status non-JSON: ${text.slice(0, 200)}`);
    }
    lastRaw = parsed;
    const status = String(parsed["status"] ?? "");
    const tHash = String(parsed["txHash"] ?? parsed["transactionHash"] ?? "");
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  +${elapsed}s status=${status}${tHash ? ` tx=${tHash.slice(0, 12)}…` : ""}`);
    if (status === "completed" || status === "success") {
      return { status, raw: parsed };
    }
    if (status === "failed" || status === "error") {
      return { status, raw: parsed };
    }
    await new Promise((r) => setTimeout(r, 4_000));
  }
  return { status: "timeout", raw: lastRaw };
}

async function main(): Promise<void> {
  console.log("=== Spike 19 — Real USDC end-to-end payout via KeeperHub ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpc = process.env["BASE_SEPOLIA_RPC"] ?? "https://sepolia.base.org";
  const usdcAddr = process.env["BASE_SEPOLIA_USDC"] ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const routerAddr = must("BASE_PAYMENT_ROUTER");
  const apiKey = must("KEEPERHUB_API_KEY");
  const khEndpoint = process.env["KEEPERHUB_ENDPOINT"] ?? "https://app.keeperhub.com/api";

  const provider = new ethers.JsonRpcProvider(rpc);
  const userKey = must("DEMO_PLANNER_KEY");
  const userWallet = new ethers.Wallet(userKey, provider);

  const recipients: Recipient[] = [
    { label: "Planner",      address: must("PLANNER_OPERATOR_WALLET"),      amountUnits: 150_000n }, // 0.15 USDC (15%)
    { label: "Researcher 1", address: must("RESEARCHER_1_OPERATOR_WALLET"), amountUnits: 300_000n }, // 0.30 (30%)
    { label: "Researcher 2", address: must("RESEARCHER_2_OPERATOR_WALLET"), amountUnits: 300_000n }, // 0.30 (30%)
    { label: "Critic",       address: must("CRITIC_OPERATOR_WALLET"),       amountUnits: 150_000n }, // 0.15 (15%)
    { label: "Synthesizer",  address: must("SYNTHESIZER_OPERATOR_WALLET"),  amountUnits: 100_000n }, // 0.10 (10%)
  ];
  const totalUnits = recipients.reduce((acc, r) => acc + r.amountUnits, 0n);
  if (totalUnits !== 1_000_000n) throw new Error(`split bug: total=${totalUnits} expected=1_000_000`);

  // bountyKey is opaque to PaymentRouter — we control it. Tag with a timestamp
  // so multiple Spike 19 runs don't collide on AlreadyFunded.
  const bountyKey = ethers.keccak256(
    ethers.toUtf8Bytes(`scholar-swarm-spike-19-${Date.now()}`),
  );

  console.log(`User (funder):     ${userWallet.address}`);
  console.log(`PaymentRouter:     ${routerAddr}`);
  console.log(`USDC token:        ${usdcAddr}`);
  console.log(`bountyKey:         ${bountyKey}`);
  console.log(`Total escrow:      1.000000 USDC (1_000_000 base units)\n`);

  const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, userWallet) as any;
  const router = new ethers.Contract(routerAddr, ROUTER_ABI, userWallet) as any;
  const decimals: number = Number(await usdc.decimals());
  if (decimals !== 6) throw new Error(`unexpected USDC decimals: ${decimals}`);

  // ── Step 0: pre-flight balances ───────────────────────────────────────
  console.log("Step 0: pre-flight balance snapshot…");
  const balancesBefore: Record<string, bigint> = {};
  for (const r of recipients) {
    const b: bigint = await usdc.balanceOf(r.address);
    balancesBefore[r.label] = b;
    console.log(`  ${r.label.padEnd(13)} ${r.address}  USDC=${ethers.formatUnits(b, 6)}`);
  }
  const userUsdcBefore: bigint = await usdc.balanceOf(userWallet.address);
  const routerUsdcBefore: bigint = await usdc.balanceOf(routerAddr);
  console.log(`  user USDC:     ${ethers.formatUnits(userUsdcBefore, 6)}`);
  console.log(`  router USDC:   ${ethers.formatUnits(routerUsdcBefore, 6)}\n`);

  if (userUsdcBefore < 1_000_000n) {
    throw new Error(`user has only ${ethers.formatUnits(userUsdcBefore, 6)} USDC, need ≥1.0`);
  }

  // ── Step 1: approve(router, 1 USDC) ──────────────────────────────────
  console.log("Step 1: approve(router, 1 USDC)…");
  const approveTx = await usdc.approve(routerAddr, 1_000_000n);
  console.log(`  tx: ${approveTx.hash}`);
  console.log(`  ${BASESCAN}/tx/${approveTx.hash}`);
  await approveTx.wait();
  console.log("  ✅ approved\n");

  // ── Step 2: fund(bountyKey, 1 USDC) ──────────────────────────────────
  console.log("Step 2: fund(bountyKey, 1 USDC)…");
  const fundTx = await router.fund(bountyKey, 1_000_000n);
  console.log(`  tx: ${fundTx.hash}`);
  console.log(`  ${BASESCAN}/tx/${fundTx.hash}`);
  const fundReceipt = await fundTx.wait();
  console.log(`  ✅ funded (block ${fundReceipt.blockNumber})\n`);

  // verify escrow row landed
  const escrow = await router.escrow(bountyKey);
  console.log(`  escrow.user=${escrow.user}`);
  console.log(`  escrow.totalAmount=${ethers.formatUnits(escrow.totalAmount, 6)} USDC`);
  console.log(`  escrow.status=${ESCROW_STATUS_NAMES[Number(escrow.status)] ?? "?"}\n`);
  if (Number(escrow.status) !== 1) throw new Error("escrow not in Funded state after fund()");

  // ── Step 3: trigger KH Direct Execution → distribute() ───────────────
  console.log("Step 3: KH Direct Execution → distribute()…");
  const recipientsArr = recipients.map((r) => r.address);
  const amountsArr = recipients.map((r) => r.amountUnits.toString());
  console.log(`  recipients (${recipientsArr.length}):`);
  for (const r of recipients) {
    console.log(`    ${r.label.padEnd(13)} ${r.address}  ${ethers.formatUnits(r.amountUnits, 6)} USDC`);
  }

  const trigger = await khTriggerDistribute(khEndpoint, apiKey, routerAddr, bountyKey, recipientsArr, amountsArr);
  console.log(`  executionId: ${trigger.executionId}`);
  console.log(`  raw response: ${JSON.stringify(trigger.raw).slice(0, 400)}\n`);

  // ── Step 4: poll until on-chain ──────────────────────────────────────
  console.log("Step 4: polling KH execution status…");
  const polled = await khPollExecution(khEndpoint, apiKey, trigger.executionId);
  console.log(`  final status: ${polled.status}`);
  console.log(`  final raw:    ${JSON.stringify(polled.raw).slice(0, 600)}\n`);

  let distributeTxHash: string | null = null;
  const polledRaw = polled.raw as Record<string, unknown> | null;
  if (polledRaw) {
    distributeTxHash =
      (polledRaw["txHash"] as string | undefined) ??
      (polledRaw["transactionHash"] as string | undefined) ??
      (polledRaw["hash"] as string | undefined) ??
      null;
  }
  if (distributeTxHash) {
    console.log(`  distribute tx: ${distributeTxHash}`);
    console.log(`  ${BASESCAN}/tx/${distributeTxHash}\n`);
  } else {
    console.log("  ⚠ no txHash in KH response — will rely on escrow state + balance diff for proof.\n");
  }

  // ── Step 5: post-flight verification ─────────────────────────────────
  console.log("Step 5: post-flight verification…");
  // small delay so the RPC sees the latest block
  await new Promise((r) => setTimeout(r, 4_000));

  const escrowAfter = await router.escrow(bountyKey);
  console.log(`  escrow.status=${ESCROW_STATUS_NAMES[Number(escrowAfter.status)] ?? "?"}`);
  if (Number(escrowAfter.status) !== 2) {
    console.error(`  ❌ escrow not in Distributed state — KH execution likely failed`);
  }

  const balancesAfter: Record<string, bigint> = {};
  let totalDelta = 0n;
  let allOk = true;
  for (const r of recipients) {
    const b: bigint = await usdc.balanceOf(r.address);
    balancesAfter[r.label] = b;
    const delta = b - (balancesBefore[r.label] ?? 0n);
    totalDelta += delta;
    const ok = delta === r.amountUnits;
    if (!ok) allOk = false;
    console.log(
      `  ${r.label.padEnd(13)} delta=${ethers.formatUnits(delta, 6).padStart(10)} expected=${ethers
        .formatUnits(r.amountUnits, 6)
        .padStart(6)}  ${ok ? "✅" : "❌"}`,
    );
  }
  console.log(`  total moved:  ${ethers.formatUnits(totalDelta, 6)} USDC (expected 1.000000)\n`);

  // ── Persist artifact ─────────────────────────────────────────────────
  const artifact = {
    spike: "19-real-usdc-payout",
    runAt: new Date().toISOString(),
    chain: "Base Sepolia",
    chainId: 84532,
    paymentRouter: routerAddr,
    usdcToken: usdcAddr,
    user: userWallet.address,
    bountyKey,
    totalEscrowUsdc: "1.0",
    recipients: recipients.map((r) => ({
      label: r.label,
      address: r.address,
      amountUnits: r.amountUnits.toString(),
      amountUsdc: ethers.formatUnits(r.amountUnits, 6),
      balanceBefore: balancesBefore[r.label]?.toString(),
      balanceAfter: balancesAfter[r.label]?.toString(),
      delta: ((balancesAfter[r.label] ?? 0n) - (balancesBefore[r.label] ?? 0n)).toString(),
    })),
    txs: {
      approve: approveTx.hash,
      fund: fundTx.hash,
      distribute: distributeTxHash,
    },
    explorerLinks: {
      approve: `${BASESCAN}/tx/${approveTx.hash}`,
      fund: `${BASESCAN}/tx/${fundTx.hash}`,
      distribute: distributeTxHash ? `${BASESCAN}/tx/${distributeTxHash}` : null,
      router: `${BASESCAN}/address/${routerAddr}`,
    },
    keeperhub: {
      endpoint: khEndpoint,
      executionId: trigger.executionId,
      finalStatus: polled.status,
      triggerResponse: trigger.raw,
      finalResponse: polled.raw,
    },
    pass: allOk && Number(escrowAfter.status) === 2,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-19.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact: docs/spike-artifacts/spike-19.json\n`);

  if (artifact.pass) {
    console.log("=== Spike 19 PASS ===");
    console.log("Real Circle USDC distributed across 5 distinct operator wallets via KeeperHub.");
    console.log("Cross-chain payout rail proven end-to-end on Base Sepolia.");
  } else {
    console.error("=== Spike 19 INCOMPLETE ===");
    console.error("Funds may have moved partially — inspect artifact and Basescan tx links.");
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 19 failed:");
  console.error(err);
  process.exit(1);
});
