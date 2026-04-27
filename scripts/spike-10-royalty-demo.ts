/**
 * Spike 10 — AgentRoyaltyVault live royalty split demo on 0G Galileo.
 *
 * Demonstrates pay-to-authorize with automatic 95/5 split:
 *   1. iNFT #1 owner (Planner-Alpha operator) sets a usage fee of 0.002 OG
 *   2. Deployer (acting as a third-party payer) calls payAndAuthorize
 *   3. Vault routes 95% (0.0019 OG) to the iNFT owner, 5% (0.0001 OG) to creator
 *   4. We capture before/after balances + tx hash + the UsageAuthorized event
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-10-royalty-demo.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

const VAULT_ABI = [
  "function setUsageFee(uint256 tokenId, uint256 newFee)",
  "function payAndAuthorize(uint256 tokenId, address user, uint256 expiresAt) payable returns (uint256 ownerShare, uint256 creatorShare)",
  "function usageFee(uint256) view returns (uint256)",
  "function isAuthorized(uint256 tokenId, address user) view returns (bool)",
  "function lifetimeRevenue(uint256) view returns (uint256)",
  "function creator() view returns (address)",
  "event UsageAuthorized(uint256 indexed tokenId,address indexed payer,address indexed user,uint256 expiresAt,uint256 paid,uint256 ownerShare,uint256 creatorShare,address ownerAt,address creatorAt)",
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 10 — AgentRoyaltyVault live split (0G Galileo) ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const explorer = process.env["OG_EXPLORER_URL"] ?? "https://chainscan-galileo.0g.ai";
  const vaultAddr = must("OG_ROYALTY_VAULT");
  const ownerKey = must("PLANNER_OPERATOR_KEY"); // owner of agentId 1
  const payerKey = must("DEMO_PLANNER_KEY"); // third-party payer

  const provider = new ethers.JsonRpcProvider(rpc);
  const ownerWallet = new ethers.Wallet(ownerKey, provider);
  const payerWallet = new ethers.Wallet(payerKey, provider);

  const vaultAsOwner = new ethers.Contract(vaultAddr, VAULT_ABI, ownerWallet) as any;
  const vaultAsPayer = new ethers.Contract(vaultAddr, VAULT_ABI, payerWallet) as any;
  const vaultRead = new ethers.Contract(vaultAddr, VAULT_ABI, provider) as any;

  const tokenId = 1n;
  const fee = ethers.parseEther("0.002");
  const user = ethers.Wallet.createRandom().address;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86_400);

  const creator = (await vaultRead.creator()) as string;
  console.log(`Vault:   ${vaultAddr}`);
  console.log(`Owner:   ${ownerWallet.address} (agentId ${tokenId})`);
  console.log(`Creator: ${creator}`);
  console.log(`Payer:   ${payerWallet.address}`);
  console.log(`User:    ${user} (random fresh)`);
  console.log(`Fee:     ${ethers.formatEther(fee)} OG\n`);

  // 1. Owner sets fee.
  console.log("Step 1: owner sets usage fee…");
  const setTx = await vaultAsOwner.setUsageFee(tokenId, fee, {
    gasLimit: 100_000n,
    gasPrice: ethers.parseUnits("4", "gwei"),
  });
  console.log(`  setUsageFee tx: ${setTx.hash}`);
  await setTx.wait();
  const onChainFee: bigint = await vaultRead.usageFee(tokenId);
  console.log(`  on-chain fee: ${ethers.formatEther(onChainFee)} OG\n`);

  // 2. Capture balances.
  const ownerBefore = await provider.getBalance(ownerWallet.address);
  const creatorBefore = await provider.getBalance(creator);
  console.log("Balances before payment:");
  console.log(`  owner:   ${ethers.formatEther(ownerBefore)} OG`);
  console.log(`  creator: ${ethers.formatEther(creatorBefore)} OG\n`);

  // 3. Payer calls payAndAuthorize.
  console.log("Step 2: payer calls payAndAuthorize…");
  const payTx = await vaultAsPayer.payAndAuthorize(tokenId, user, deadline, {
    value: fee,
    gasLimit: 200_000n,
    gasPrice: ethers.parseUnits("4", "gwei"),
  });
  console.log(`  payAndAuthorize tx: ${payTx.hash}`);
  const receipt = await payTx.wait();
  console.log(`  block: ${receipt.blockNumber}`);

  // 4. Parse event.
  let ownerShare = 0n;
  let creatorShare = 0n;
  for (const log of receipt.logs) {
    try {
      const parsed = (vaultRead as any).interface.parseLog(log);
      if (parsed?.name === "UsageAuthorized") {
        ownerShare = parsed.args.ownerShare as bigint;
        creatorShare = parsed.args.creatorShare as bigint;
        break;
      }
    } catch {
      /* not vault log */
    }
  }
  console.log(`  owner share:   ${ethers.formatEther(ownerShare)} OG (95%)`);
  console.log(`  creator share: ${ethers.formatEther(creatorShare)} OG (5%)\n`);

  // 5. Capture balances after.
  const ownerAfter = await provider.getBalance(ownerWallet.address);
  const creatorAfter = await provider.getBalance(creator);
  console.log("Balances after payment:");
  console.log(`  owner:   ${ethers.formatEther(ownerAfter)} OG  (delta +${ethers.formatEther(ownerAfter - ownerBefore)})`);
  console.log(`  creator: ${ethers.formatEther(creatorAfter)} OG  (delta +${ethers.formatEther(creatorAfter - creatorBefore)})\n`);

  // 6. Verify authorization is recorded.
  const authorized = (await vaultRead.isAuthorized(tokenId, user)) as boolean;
  const lifetime = (await vaultRead.lifetimeRevenue(tokenId)) as bigint;
  console.log(`isAuthorized(${user}): ${authorized}`);
  console.log(`lifetimeRevenue(${tokenId}): ${ethers.formatEther(lifetime)} OG\n`);

  const artifact = {
    spike: "10-royalty-demo",
    runAt: new Date().toISOString(),
    vault: vaultAddr,
    chain: "0G Galileo",
    chainId: 16602,
    tokenId: tokenId.toString(),
    fee: fee.toString(),
    setFeeTxHash: setTx.hash,
    payAndAuthorizeTxHash: payTx.hash,
    setFeeExplorer: `${explorer}/tx/${setTx.hash}`,
    payAndAuthorizeExplorer: `${explorer}/tx/${payTx.hash}`,
    ownerShare: ownerShare.toString(),
    creatorShare: creatorShare.toString(),
    ownerDeltaWei: (ownerAfter - ownerBefore).toString(),
    creatorDeltaWei: (creatorAfter - creatorBefore).toString(),
    authorized,
    lifetimeRevenue: lifetime.toString(),
  };
  await writeFile(join(ARTIFACT_DIR, "spike-10.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact: docs/spike-artifacts/spike-10.json`);

  console.log("\n=== Go/No-go Gate ===");
  const splitOk = ownerShare === fee - creatorShare && creatorShare === (fee * 500n) / 10_000n;
  console.log(`Set-fee tx confirmed:    ${setTx.hash ? "✅" : "❌"}`);
  console.log(`Pay tx confirmed:        ${payTx.hash ? "✅" : "❌"}`);
  console.log(`Split is 95/5 exactly:   ${splitOk ? "✅" : "❌"}`);
  console.log(`User authorized on-chain: ${authorized ? "✅" : "❌"}`);

  if (!splitOk || !authorized) {
    console.error("\n❌ Royalty demo failed.");
    process.exit(1);
  }
  console.log("\n✅ Spike 10 PASS — automatic royalty split landed on-chain.");
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 10 failed:");
  console.error(err);
  process.exit(1);
});
