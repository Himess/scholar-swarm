/**
 * Spike 18 bootstrap — give each operator wallet its own 0G Compute ledger
 * (a.k.a. sub-account with the inference provider).
 *
 * Run ONCE before the first spike-18 attempt. Idempotent: each wallet's
 * ledger is checked first via getLedger(); if it already exists with
 * positive balance, the script skips funding.
 *
 * After this:
 *   - planner / r1 / r2 / critic operator wallets each have their own
 *     0G Compute ledger funded with INFERENCE_FUND_OG (default 0.3).
 *   - Synthesizer is skipped — its role doesn't call inference (it gets
 *     other agents' findings + reviews and runs a final LLM call ALSO via
 *     its own ledger).
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-18-bootstrap-inference.ts
 */

import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const FUND_OG = Number(process.env["INFERENCE_FUND_OG"] ?? "0.3");

interface AgentToBootstrap {
  role: string;
  keyEnv: string;
}

const TARGETS: AgentToBootstrap[] = [
  { role: "planner", keyEnv: "PLANNER_OPERATOR_KEY" },
  { role: "researcher-1", keyEnv: "RESEARCHER_1_OPERATOR_KEY" },
  { role: "researcher-2", keyEnv: "RESEARCHER_2_OPERATOR_KEY" },
  { role: "critic", keyEnv: "CRITIC_OPERATOR_KEY" },
  { role: "synthesizer", keyEnv: "SYNTHESIZER_OPERATOR_KEY" },
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// 0G Compute provider currently in use on testnet (qwen-2.5-7b-instruct via TeeML).
// Same provider all five agents will hit in spike-18.
const COMPUTE_PROVIDER = "0xa48f01287233509FD694a22Bf840225062E67836";
// Amount funded into the provider sub-account from the ledger. 1 OG covers
// many inference calls; transferred from the existing ledger balance.
const SUBACCOUNT_FUND_OG = Number(process.env["SUBACCOUNT_FUND_OG"] ?? "1");

async function bootstrap(target: AgentToBootstrap): Promise<{
  ledger: { existed: boolean; balanceOG: string };
  subAccount: { existed: boolean; balanceOG: string };
}> {
  const rpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(must(target.keyEnv), provider);

  const broker = await createZGComputeNetworkBroker(wallet as any);

  // ── Step 1: ledger ─────────────────────────────────────────────────────
  let ledgerExisted = false;
  let ledgerBalance = 0n;
  try {
    const led = (await broker.ledger.getLedger()) as any;
    ledgerBalance = BigInt(led.totalBalance ?? led[2] ?? 0);
    ledgerExisted = ledgerBalance > 0n;
  } catch {
    /* absent */
  }
  if (!ledgerExisted) {
    await broker.ledger.addLedger(FUND_OG);
    const led2 = (await broker.ledger.getLedger()) as any;
    ledgerBalance = BigInt(led2.totalBalance ?? led2[2] ?? 0);
  }

  // ── Step 2: provider sub-account ───────────────────────────────────────
  let subExisted = false;
  let subBalance = 0n;
  try {
    const acc = (await broker.inference.getAccount(COMPUTE_PROVIDER)) as any;
    // AccountStructOutput.balance — uint256 in neurons.
    subBalance = BigInt(acc.balance ?? acc[1] ?? 0);
    subExisted = subBalance > 0n;
  } catch {
    /* absent — transferFund will create */
  }

  if (!subExisted) {
    const amountNeurons = ethers.parseEther(String(SUBACCOUNT_FUND_OG));
    await (broker.ledger as any).transferFund(
      COMPUTE_PROVIDER,
      "inference",
      amountNeurons,
    );
    try {
      const acc2 = (await broker.inference.getAccount(COMPUTE_PROVIDER)) as any;
      subBalance = BigInt(acc2.balance ?? acc2[1] ?? 0);
    } catch {
      /* read-back failed but the tx went through */
    }
  }

  return {
    ledger: { existed: ledgerExisted, balanceOG: ethers.formatEther(ledgerBalance) },
    subAccount: { existed: subExisted, balanceOG: ethers.formatEther(subBalance) },
  };
}

async function main(): Promise<void> {
  console.log("=== Spike 18 bootstrap — per-agent 0G Compute ledgers ===\n");
  console.log(`Funding amount per wallet: ${FUND_OG} OG`);
  console.log(`Target wallets: ${TARGETS.length}\n`);

  for (const t of TARGETS) {
    console.log(`\n[${t.role}]`);
    try {
      const r = await bootstrap(t);
      const lprefix = r.ledger.existed ? "✓ ledger existed" : "+ ledger created";
      const sprefix = r.subAccount.existed ? "✓ sub-account existed" : "+ sub-account funded";
      console.log(`  ${lprefix} (balance ${r.ledger.balanceOG} OG)`);
      console.log(`  ${sprefix} (balance ${r.subAccount.balanceOG} OG)`);
    } catch (err) {
      console.log(`  ✗ FAILED: ${(err as Error).message}`);
    }
  }

  console.log("\nDone. Each wallet can now call 0G Compute inference under its own identity.");
  console.log("Re-run is idempotent — pre-existing ledgers are skipped.");
}

main().catch((err: Error) => {
  console.error("\n❌ Bootstrap failed:");
  console.error(err);
  process.exit(1);
});
