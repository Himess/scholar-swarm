/**
 * Day 5 #1 — Redistribute the 5 minted iNFTs to five distinct operator wallets.
 *
 * The "different operators" pitch falls apart if all five iNFTs share a single
 * owner (the deployer). This script:
 *   1. Generates five fresh EOAs via `ethers.Wallet.createRandom()`
 *   2. Persists their addresses + private keys (.env + spike-artifact)
 *   3. Funds each with `OPERATOR_FUND_AMOUNT` OG (default 0.05) for gas
 *   4. Transfers iNFT 1 → wallet 1, iNFT 2 → wallet 2, …, via AgentNFT.transferFrom
 *   5. Verifies on-chain ownership matches expectation
 *
 * Idempotent: if `docs/spike-artifacts/operator-wallets.json` exists, reuses
 * those keys instead of generating new ones. Re-running after a partial
 * failure is safe — already-transferred iNFTs are skipped.
 *
 *   pnpm exec tsx --env-file=.env scripts/redistribute-agents.ts
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");
const WALLETS_PATH = join(ARTIFACT_DIR, "operator-wallets.json");

const AGENT_NFT_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function transferFrom(address from,address to,uint256 tokenId)",
  "function totalAgents() view returns (uint256)",
];

const ROLE_NAMES = ["Planner-Alpha", "Researcher-One", "Researcher-Two", "Critic-Prime", "Synthesizer-Final"];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Day 5 #1 — redistribute 5 iNFTs to 5 operator wallets ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpcUrl = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const explorerUrl = process.env["OG_EXPLORER_URL"] ?? "https://chainscan-galileo.0g.ai";
  const fundAmountEth = process.env["OPERATOR_FUND_AMOUNT"] ?? "0.05";
  const deployerKey = must("DEMO_PLANNER_KEY");
  const agentNftAddr = must("OG_AGENT_NFT");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);
  const agentNFT = new ethers.Contract(agentNftAddr, AGENT_NFT_ABI, deployer) as any;

  console.log(`Deployer: ${deployer.address}`);
  const balance = await provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} OG`);
  console.log(`AgentNFT: ${agentNftAddr}\n`);

  // 1. Load or generate 5 wallets.
  let wallets: { name: string; agentId: number; address: string; privateKey: string }[];
  if (existsSync(WALLETS_PATH)) {
    const blob = await readFile(WALLETS_PATH, "utf8");
    wallets = JSON.parse(blob);
    console.log(`Loaded existing operator wallets from ${WALLETS_PATH}\n`);
  } else {
    wallets = [];
    for (let i = 0; i < 5; i++) {
      const w = ethers.Wallet.createRandom();
      wallets.push({
        name: ROLE_NAMES[i]!,
        agentId: i + 1,
        address: w.address,
        privateKey: w.privateKey,
      });
    }
    await writeFile(WALLETS_PATH, JSON.stringify(wallets, null, 2));
    console.log(`Generated 5 fresh operator wallets, persisted to ${WALLETS_PATH}\n`);
  }

  for (const w of wallets) {
    console.log(`  agentId=${w.agentId}  ${w.name.padEnd(20)} ${w.address}`);
  }

  // 2. Fund each operator wallet (skip if already funded above min threshold).
  const minBalance = ethers.parseEther("0.001"); // skip if already have ≥0.001
  const fundAmount = ethers.parseEther(fundAmountEth);

  console.log(`\nStep 1: funding (${fundAmountEth} OG each, skipping pre-funded)…`);
  for (const w of wallets) {
    const bal = await provider.getBalance(w.address);
    if (bal >= minBalance) {
      console.log(`  ${w.name}: already has ${ethers.formatEther(bal)} OG, skip`);
      continue;
    }
    const tx = await deployer.sendTransaction({
      to: w.address,
      value: fundAmount,
      gasLimit: 21_000n,
      gasPrice: ethers.parseUnits("4", "gwei"), // 0G testnet legacy tx
    });
    console.log(`  ${w.name}: fund tx ${tx.hash}`);
    await tx.wait();
  }

  // 3. Transfer iNFT N to wallet N (skip already-transferred).
  console.log(`\nStep 2: transfer iNFT N → wallet N (skipping already-owned)…`);
  const transferResults: { agentId: number; previousOwner: string; newOwner: string; txHash?: string }[] = [];
  for (const w of wallets) {
    const currentOwner = (await agentNFT.ownerOf(w.agentId)) as string;
    if (currentOwner.toLowerCase() === w.address.toLowerCase()) {
      console.log(`  agentId=${w.agentId}: already owned by ${w.address}, skip`);
      transferResults.push({ agentId: w.agentId, previousOwner: currentOwner, newOwner: w.address });
      continue;
    }
    if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.warn(`  agentId=${w.agentId}: owned by ${currentOwner}, not deployer. SKIPPING.`);
      transferResults.push({ agentId: w.agentId, previousOwner: currentOwner, newOwner: currentOwner });
      continue;
    }
    const tx = await agentNFT.transferFrom(deployer.address, w.address, w.agentId, {
      gasLimit: 200_000n,
      gasPrice: ethers.parseUnits("4", "gwei"),
    });
    console.log(`  agentId=${w.agentId} → ${w.address}  tx ${tx.hash}`);
    await tx.wait();
    transferResults.push({
      agentId: w.agentId,
      previousOwner: deployer.address,
      newOwner: w.address,
      txHash: tx.hash,
    });
  }

  // 4. Verify final state.
  console.log(`\nStep 3: verify on-chain ownership…`);
  const final: { agentId: number; expected: string; actual: string; match: boolean }[] = [];
  for (const w of wallets) {
    const actual = (await agentNFT.ownerOf(w.agentId)) as string;
    const match = actual.toLowerCase() === w.address.toLowerCase();
    final.push({ agentId: w.agentId, expected: w.address, actual, match });
    console.log(`  agentId=${w.agentId}  ${match ? "✅" : "❌"}  ${actual}`);
  }

  const artifact = {
    runAt: new Date().toISOString(),
    agentNFT: agentNftAddr,
    deployer: deployer.address,
    explorerBase: explorerUrl,
    operators: wallets.map((w) => ({ agentId: w.agentId, name: w.name, address: w.address })),
    transfers: transferResults,
    finalOwnership: final,
    allMatch: final.every((f) => f.match),
  };
  await writeFile(join(ARTIFACT_DIR, "redistribute-agents.json"), JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: docs/spike-artifacts/redistribute-agents.json`);

  if (!artifact.allMatch) {
    console.error("\n❌ Some transfers did not land. Investigate before submission.");
    process.exit(1);
  }

  console.log(`\n✅ All 5 iNFTs now owned by distinct operator wallets.`);
  console.log(`\n.env entries to add (also persisted in ${WALLETS_PATH}):`);
  const envBlock = wallets
    .map((w) => {
      const upper = w.name.toUpperCase().replace(/-/g, "_");
      const keyVarName = w.agentId === 1 ? "PLANNER" : w.agentId === 4 ? "CRITIC" : w.agentId === 5 ? "SYNTHESIZER" : `RESEARCHER_${w.agentId - 1}`;
      return `${keyVarName}_OPERATOR_KEY=${w.privateKey}\n${keyVarName}_OPERATOR_WALLET=${w.address}`;
    })
    .join("\n");
  console.log(envBlock);
}

main().catch((err: Error) => {
  console.error("\n❌ redistribute-agents failed:");
  console.error(err);
  process.exit(1);
});
