/**
 * Top up the 5 operator wallets from DEMO_PLANNER_KEY (deployer/faucet wallet).
 * Skips wallets that already have ≥ TARGET. Idempotent.
 *
 *   pnpm exec tsx --env-file=.env scripts/topup-operators.ts
 */

import { ethers } from "ethers";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Synth pays the LZ V2 native fee (~0.4 OG for 6-recipient payload), so it
// needs much more than the gas-only operator wallets. The other agents each
// also need to fund their own 0G Compute ledger (~0.3 OG, see Spike 18 bootstrap),
// hence the 0.4 OG floor for everyone.
const TARGET = ethers.parseEther(process.env["TOPUP_TARGET_OG"] ?? "0.4");
const SYNTH_TARGET = ethers.parseEther(process.env["TOPUP_SYNTH_TARGET_OG"] ?? "0.5");

async function main(): Promise<void> {
  const rpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpc);
  const deployer = new ethers.Wallet(must("DEMO_PLANNER_KEY"), provider);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await provider.getBalance(deployer.address))} OG\n`);

  const operators: { name: string; addr: string }[] = [
    { name: "Planner", addr: must("PLANNER_OPERATOR_WALLET") },
    { name: "R1", addr: must("RESEARCHER_1_OPERATOR_WALLET") },
    { name: "R2", addr: must("RESEARCHER_2_OPERATOR_WALLET") },
    { name: "Critic", addr: must("CRITIC_OPERATOR_WALLET") },
    { name: "Synth", addr: must("SYNTHESIZER_OPERATOR_WALLET") },
  ];

  for (const op of operators) {
    const bal = await provider.getBalance(op.addr);
    const balStr = ethers.formatEther(bal);
    const target = op.name === "Synth" ? SYNTH_TARGET : TARGET;
    if (bal >= target) {
      console.log(`  ✓ ${op.name.padEnd(8)} ${op.addr}  ${balStr} OG  (skip — already ≥ target)`);
      continue;
    }
    const send = target - bal;
    process.stdout.write(`  → ${op.name.padEnd(8)} ${op.addr}  ${balStr} OG → topping up ${ethers.formatEther(send)} OG … `);
    const tx = await deployer.sendTransaction({
      to: op.addr,
      value: send,
      gasLimit: 21_000n,
      gasPrice: ethers.parseUnits("4", "gwei"),
    });
    await tx.wait();
    console.log(`tx ${tx.hash}`);
  }

  console.log("\nFinal balances:");
  for (const op of operators) {
    const bal = ethers.formatEther(await provider.getBalance(op.addr));
    console.log(`  ${op.name.padEnd(8)} ${bal} OG`);
  }
  const finalDeployer = ethers.formatEther(await provider.getBalance(deployer.address));
  console.log(`  Deployer ${finalDeployer} OG`);
}

main().catch((err: Error) => {
  console.error("\n❌ Topup failed:", err);
  process.exit(1);
});
