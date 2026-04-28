/**
 * One-shot sweep — drain three donor wallets into the deployer.
 *
 *   pnpm exec tsx --env-file=.env scripts/sweep-donors.ts
 *
 * Hardcoded keys are testnet-only and consumed during the sweep.
 */

import { ethers } from "ethers";

const RPC = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
const DEPLOYER_ADDR = "0xF505e2E71df58D7244189072008f25f6b6aaE5ae";

const DONOR_KEYS = [
  "0x2a90af25d47b0f4f89eaddd9e770fcb24b08b635a663e76795af1aef0063cfa4",
  "0xf068eb2c7af9926bae8ac179a3cec6740a5f5f108a234a6b549d6065c310ab8c",
  "0xfb3bdca690108dfd0b55dea4331095fca115f326723bbc050e255cc809cfcabe",
];

const GAS_PRICE = ethers.parseUnits("4", "gwei");
const TRANSFER_GAS_LIMIT = 21_000n;

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC);

  for (const key of DONOR_KEYS) {
    const w = new ethers.Wallet(key, provider);
    const bal = await provider.getBalance(w.address);
    const gasReserve = GAS_PRICE * TRANSFER_GAS_LIMIT;
    const sendAmount = bal > gasReserve ? bal - gasReserve : 0n;
    process.stdout.write(`donor ${w.address}  balance=${ethers.formatEther(bal)} OG  → sending ${ethers.formatEther(sendAmount)} OG … `);
    if (sendAmount === 0n) {
      console.log("skip");
      continue;
    }
    const tx = await w.sendTransaction({
      to: DEPLOYER_ADDR,
      value: sendAmount,
      gasLimit: TRANSFER_GAS_LIMIT,
      gasPrice: GAS_PRICE,
    });
    await tx.wait();
    console.log(`tx ${tx.hash}`);
  }

  const final = await provider.getBalance(DEPLOYER_ADDR);
  console.log(`\nDeployer balance now: ${ethers.formatEther(final)} OG`);
}

main().catch((err: Error) => {
  console.error("sweep failed:", err);
  process.exit(1);
});
