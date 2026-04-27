/**
 * Spike 12 — Synthesizer fires BountyMessenger.notifyCompletion → LZ V2 → Base.
 *
 * Picks the latest Completed bounty (or BOUNTY_ADDRESS env override) and has
 * the Synthesizer operator wallet broadcast a `BountyCompleted` cross-chain
 * message via LayerZero V2. This proves the FULL pipeline:
 *
 *   Bounty contract on 0G   ──submitSynthesis──▶  Completed
 *           ↓                                          (Spike 11)
 *   Synthesizer wallet      ──notifyCompletion──▶  BountyMessenger
 *                                                       ↓
 *                                   LayerZero V2 (DVN-attested)
 *                                                       ↓
 *                            Base Sepolia PaymentMessenger
 *                                                       ↓
 *                            DistributeRequested event  ──watched by──▶  KH workflow
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-12-synth-fires-lz.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

const MESSENGER_ABI = [
  "function quote(uint32 dstEid,uint256 bountyId,address[] recipients,uint256[] amounts,bytes extraOptions) view returns (tuple(uint256 nativeFee,uint256 lzTokenFee))",
  "function notifyCompletion(uint32 dstEid,uint256 bountyId,address[] recipients,uint256[] amounts,bytes extraOptions) payable returns (tuple(bytes32 guid,uint64 nonce,tuple(uint256 nativeFee,uint256 lzTokenFee) fee))",
  "function authorizedSenders(address) view returns (bool)",
  "function defaultDstEid() view returns (uint32)",
  "event CompletionSent(uint256 indexed bountyId,bytes32 indexed messageGuid,uint64 nonce,uint32 dstEid,address[] recipients,uint256[] amounts)",
];

const PAYMENT_MESSENGER_ABI = [
  "event DistributeRequested(bytes32 indexed messageGuid,uint32 indexed srcEid,uint256 indexed bountyId,bytes32 srcSender,address[] recipients,uint256[] amounts)",
];

const NFT_ABI = ["function ownerOf(uint256) view returns (address)"];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 12 — Synthesizer fires LZ to Base ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const ogRpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const baseRpc = process.env["BASE_SEPOLIA_RPC"] ?? "https://base-sepolia-rpc.publicnode.com";
  const explorer = process.env["OG_EXPLORER_URL"] ?? "https://chainscan-galileo.0g.ai";

  const ogProvider = new ethers.JsonRpcProvider(ogRpc);
  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const synth = new ethers.Wallet(must("SYNTHESIZER_OPERATOR_KEY"), ogProvider);

  const messengerAddr = must("OG_BOUNTY_MESSENGER");
  const baseMessengerAddr = must("BASE_PAYMENT_MESSENGER");
  const agentNftAddr = must("OG_AGENT_NFT");

  const messenger = new ethers.Contract(messengerAddr, MESSENGER_ABI, synth) as any;
  const baseMessenger = new ethers.Contract(baseMessengerAddr, PAYMENT_MESSENGER_ABI, baseProvider) as any;
  const nft = new ethers.Contract(agentNftAddr, NFT_ABI, ogProvider) as any;

  // Pre-flight: synth authorized?
  const authorized = (await messenger.authorizedSenders(synth.address)) as boolean;
  console.log(`Synth ${synth.address}`);
  console.log(`  authorized on messenger: ${authorized ? "✅" : "❌"}`);
  console.log(`  balance: ${ethers.formatEther(await ogProvider.getBalance(synth.address))} OG\n`);
  if (!authorized) throw new Error("Synth not authorized on BountyMessenger");

  // Resolve operator wallets via AgentNFT (auto-derived, not env-dependent).
  const owners = await Promise.all([1n, 2n, 3n, 4n, 5n].map((id) => nft.ownerOf(id) as Promise<string>));
  const [plannerWallet, r1Wallet, r2Wallet, criticWallet, synthWallet] = owners;
  console.log("Recipient wallets (read from AgentNFT.ownerOf):");
  console.log(`  Planner:    ${plannerWallet}`);
  console.log(`  R1:         ${r1Wallet}`);
  console.log(`  R2:         ${r2Wallet}`);
  console.log(`  Critic:     ${criticWallet}`);
  console.log(`  Synth:      ${synthWallet}\n`);

  // Bounty id from Spike 11 + payouts: 1000 USDC budget, fixed split.
  const bountyId = BigInt(process.env["BOUNTY_ID"] ?? "2");
  const u = (s: string) => ethers.parseUnits(s, 6);
  const recipients = [plannerWallet, r1Wallet, r2Wallet, r1Wallet, criticWallet, synthWallet];
  // amounts: planner 150, r1 (task 0) 200, r2 (task 1) 200, r1 (task 2) 200, critic 150, synth 100  → 1000
  const amounts = [u("150"), u("200"), u("200"), u("200"), u("150"), u("100")];
  console.log(`Payload bountyId=${bountyId}, total ${ethers.formatUnits(amounts.reduce((a, b) => a + b, 0n), 6)} USDC`);
  console.log(`  recipients × amounts:`);
  for (let i = 0; i < recipients.length; i++) {
    console.log(`    ${recipients[i]}  ${ethers.formatUnits(amounts[i]!, 6)} USDC`);
  }
  console.log();

  const extraOptions = "0x";

  // 1. Quote LZ fee
  console.log("Step 1: quote LZ fee…");
  const fee = await messenger.quote(40245, bountyId, recipients, amounts, extraOptions);
  console.log(`  nativeFee: ${ethers.formatEther(fee.nativeFee)} OG\n`);

  // 2. notifyCompletion
  console.log("Step 2: notifyCompletion (Synth signs)…");
  const tx = await messenger.notifyCompletion(40245, bountyId, recipients, amounts, extraOptions, {
    value: fee.nativeFee,
    gasLimit: 700_000n,
    gasPrice: ethers.parseUnits("4", "gwei"),
  });
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();

  let guid: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = (messenger as any).interface.parseLog(log);
      if (parsed?.name === "CompletionSent") {
        guid = parsed.args.messageGuid as string;
        break;
      }
    } catch {
      /* */
    }
  }
  if (!guid) throw new Error("CompletionSent event missing");
  console.log(`  GUID: ${guid}`);
  console.log(`  LZ Scan: https://testnet.layerzeroscan.com/tx/${tx.hash}`);
  console.log(`  block: ${receipt.blockNumber}\n`);

  // 3. Poll Base for DistributeRequested
  console.log("Step 3: polling Base Sepolia for DistributeRequested (up to 5 min)…");
  const deadline = Date.now() + 5 * 60 * 1000;
  let baseTxHash: string | null = null;
  let baseBlock: number | null = null;
  while (Date.now() < deadline) {
    const head = await baseProvider.getBlockNumber();
    const fromBlock = Math.max(0, head - 500);
    const filter = baseMessenger.filters.DistributeRequested(guid);
    const logs = await baseMessenger.queryFilter(filter, fromBlock, head);
    if (logs.length > 0) {
      baseTxHash = (logs[0] as ethers.EventLog).transactionHash;
      baseBlock = (logs[0] as ethers.EventLog).blockNumber;
      console.log(`  ✓ DistributeRequested received block ${baseBlock} tx ${baseTxHash}`);
      break;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log("");

  const artifact = {
    spike: "12-synth-fires-lz",
    runAt: new Date().toISOString(),
    bountyId: bountyId.toString(),
    src: { chain: "0G Galileo", chainId: 16602, eid: 40428, messenger: messengerAddr, txHash: tx.hash, signer: synth.address },
    dst: { chain: "Base Sepolia", chainId: 84532, eid: 40245, messenger: baseMessengerAddr, txHash: baseTxHash, block: baseBlock },
    payload: { recipients, amounts: amounts.map((a) => a.toString()) },
    fee: fee.nativeFee.toString(),
    guid,
    delivered: !!baseTxHash,
    layerZeroScan: `https://testnet.layerzeroscan.com/tx/${tx.hash}`,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-12.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact: docs/spike-artifacts/spike-12.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`Synth signed notifyCompletion:  ${tx.hash ? "✅" : "❌"}`);
  console.log(`Base DistributeRequested fired: ${baseTxHash ? "✅" : "⏳ still in flight"}`);

  if (baseTxHash) {
    console.log(`\n✅ Spike 12 PASS — full pipeline 0G Bounty → Synth → LZ V2 → Base verified.`);
  } else {
    console.log(`\n🟡 Spike 12 PARTIAL — 0G send confirmed; Base delivery still flowing through DVN.`);
  }
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 12 failed:");
  console.error(err);
  process.exit(1);
});
