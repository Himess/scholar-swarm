/**
 * Pre-flight check for Spike 18 demo rejection test.
 * Verifies operator wallets have enough 0G gas + AXL nodes binary present.
 *   pnpm exec tsx --env-file=.env scripts/preflight-spike18.ts
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";

const RPC = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
const ROOT = process.cwd();

const wallets = [
  ["Planner",      process.env["PLANNER_OPERATOR_WALLET"]],
  ["Researcher 1", process.env["RESEARCHER_1_OPERATOR_WALLET"]],
  ["Researcher 2", process.env["RESEARCHER_2_OPERATOR_WALLET"]],
  ["Critic",       process.env["CRITIC_OPERATOR_WALLET"]],
  ["Synthesizer",  process.env["SYNTHESIZER_OPERATOR_WALLET"]],
] as const;

const axlNodes = [
  "axl-node-planner",
  "axl-node-r1",
  "axl-node-r2",
  "axl-node-critic",
  "axl-node-synth",
];

async function main(): Promise<void> {
  console.log("=== Pre-flight: Spike 18 demo rejection ===\n");
  const provider = new ethers.JsonRpcProvider(RPC);

  // 1. Wallet balances
  // For rejection-only test, all wallets need ≥ 0.05 OG.
  // For full E2E (synthesis fires LZ), Synth needs ≥ 0.5 — irrelevant when
  // task 1 is rejected, since bounty never reaches Synthesizing stage.
  const fullE2E = process.env["PREFLIGHT_REQUIRE_FULL_E2E"] === "1";
  console.log(`1. Operator wallet OG balances (need ≥ 0.05${fullE2E ? "; synth ≥ 0.5 for full E2E" : ", rejection-only test"}):`);
  let allOk = true;
  for (const [label, addr] of wallets) {
    if (!addr) {
      console.log(`   ${label}: ❌ env var missing`);
      allOk = false;
      continue;
    }
    const bal = await provider.getBalance(addr);
    const og = Number(ethers.formatEther(bal));
    const min = label === "Synthesizer" && fullE2E ? 0.5 : 0.05;
    const ok = og >= min;
    if (!ok) allOk = false;
    console.log(`   ${label.padEnd(13)} ${addr}  ${og.toFixed(4)} OG  ${ok ? "✅" : `❌ need ≥${min}`}`);
  }

  // 2. AXL binaries
  console.log("\n2. AXL node binaries present:");
  for (const dir of axlNodes) {
    const exe = join(ROOT, "infra", dir, "node.exe");
    const ok = existsSync(exe);
    if (!ok) allOk = false;
    console.log(`   ${dir.padEnd(20)} ${ok ? "✅" : "❌ missing"}`);
  }

  // 3. Required env vars
  console.log("\n3. Required env vars:");
  const required = [
    "OG_BOUNTY_FACTORY",
    "OG_BOUNTY_MESSENGER",
    "AXL_PEER_ID_PLANNER",
    "AXL_PEER_ID_RESEARCHER_1",
    "AXL_PEER_ID_RESEARCHER_2",
    "AXL_PEER_ID_CRITIC",
    "AXL_PEER_ID_SYNTHESIZER",
    "RETRIEVAL_PROVIDER",
    "SEARXNG_ENDPOINT",
    "DEMO_PLANNER_KEY",
  ];
  for (const k of required) {
    const v = process.env[k];
    const ok = v !== undefined && v !== "";
    if (!ok) allOk = false;
    console.log(`   ${k.padEnd(28)} ${ok ? "✅" : "❌"}`);
  }

  console.log(`\n=== ${allOk ? "✅ ALL PRE-FLIGHT CHECKS PASS" : "❌ SOME CHECKS FAILED — fix before launching"} ===`);
  if (!allOk) process.exit(1);
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
