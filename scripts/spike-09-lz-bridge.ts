/**
 * Spike 9 — LayerZero V2 cross-chain message: 0G Galileo → Base Sepolia.
 *
 * Goal:
 *   1. Quote LZ fee for a notifyCompletion(bountyId, recipients, amounts) message
 *   2. Send the message from BountyMessenger on 0G with msg.value = fee
 *   3. Capture the GUID + LZ scan link
 *   4. Poll Base side for the DistributeRequested event
 *   5. Confirm event received → cross-chain pipe is live
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-09-lz-bridge.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

const BOUNTY_MESSENGER_ABI = [
  "function quote(uint32 dstEid,uint256 bountyId,address[] recipients,uint256[] amounts,bytes extraOptions) view returns (tuple(uint256 nativeFee,uint256 lzTokenFee))",
  "function notifyCompletion(uint32 dstEid,uint256 bountyId,address[] recipients,uint256[] amounts,bytes extraOptions) payable returns (tuple(bytes32 guid,uint64 nonce,tuple(uint256 nativeFee,uint256 lzTokenFee) fee))",
  "function defaultDstEid() view returns (uint32)",
  "function peers(uint32) view returns (bytes32)",
  "event CompletionSent(uint256 indexed bountyId,bytes32 indexed messageGuid,uint64 nonce,uint32 dstEid,address[] recipients,uint256[] amounts)",
];

const PAYMENT_MESSENGER_ABI = [
  "event DistributeRequested(bytes32 indexed messageGuid,uint32 indexed srcEid,uint256 indexed bountyId,bytes32 srcSender,address[] recipients,uint256[] amounts)",
  "function seen(bytes32) view returns (bool)",
  "function peers(uint32) view returns (bytes32)",
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 9 — LayerZero V2 cross-chain (0G → Base) ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const ogRpc = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const baseRpc = process.env["BASE_SEPOLIA_RPC"] ?? "https://base-sepolia-rpc.publicnode.com";
  const privateKey = must("DEMO_PLANNER_KEY");
  const ogMessengerAddr = must("OG_BOUNTY_MESSENGER");
  const baseMessengerAddr = must("BASE_PAYMENT_MESSENGER");

  const ogProvider = new ethers.JsonRpcProvider(ogRpc);
  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const ogWallet = new ethers.Wallet(privateKey, ogProvider);

  const og = new ethers.Contract(ogMessengerAddr, BOUNTY_MESSENGER_ABI, ogWallet) as any;
  const base = new ethers.Contract(baseMessengerAddr, PAYMENT_MESSENGER_ABI, baseProvider) as any;

  console.log(`0G  BountyMessenger:  ${ogMessengerAddr}`);
  console.log(`Base PaymentMessenger: ${baseMessengerAddr}`);
  console.log(`Sender wallet: ${ogWallet.address}`);

  // 1. Verify peers are wired
  const ogToBasePeer: string = await og.peers(40245);
  const baseToOgPeer: string = await base.peers(40428);
  console.log(`\n0G → Base peer: ${ogToBasePeer}`);
  console.log(`Base → 0G peer: ${baseToOgPeer}`);
  if (ogToBasePeer === ethers.ZeroHash) throw new Error("0G peer not set");
  if (baseToOgPeer === ethers.ZeroHash) throw new Error("Base peer not set");

  // 2. Build a tiny test payload
  const bountyId = 999n;
  const recipients = [
    "0xF505e2E71df58D7244189072008f25f6b6aaE5ae",
    "0x000000000000000000000000000000000000dEaD",
  ];
  const amounts = [50_000_000n, 50_000_000n]; // 50 + 50 USDC (6 decimals)
  const extraOptions = "0x"; // use default options in contract

  // 3. Quote fee
  console.log("\nStep 1: quote LZ fee…");
  const fee = await og.quote(40245, bountyId, recipients, amounts, extraOptions);
  console.log(`  nativeFee:  ${ethers.formatEther(fee.nativeFee)} OG`);
  console.log(`  lzTokenFee: ${fee.lzTokenFee.toString()}`);

  // 4. Send
  console.log("\nStep 2: notifyCompletion on 0G with attached fee…");
  const tx = await og.notifyCompletion(40245, bountyId, recipients, amounts, extraOptions, {
    value: fee.nativeFee,
  });
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  mined block: ${receipt.blockNumber}`);

  // 5. Extract GUID from event
  let guid: string | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = og.interface.parseLog(log);
      if (parsed?.name === "CompletionSent") {
        guid = parsed.args.messageGuid as string;
        console.log(`  CompletionSent guid: ${guid}`);
        break;
      }
    } catch {
      /* not our log */
    }
  }
  if (!guid) throw new Error("CompletionSent event not found");

  console.log(`\nLayerZero scan: https://testnet.layerzeroscan.com/tx/${tx.hash}`);

  // 6. Poll Base side for DistributeRequested
  console.log("\nStep 3: polling Base for DistributeRequested (up to 5 min)…");
  const deadlineMs = Date.now() + 5 * 60 * 1000;
  let baseEvent: any = null;
  let baseTxHash: string | null = null;

  while (Date.now() < deadlineMs) {
    // Look back ~200 blocks
    const head = await baseProvider.getBlockNumber();
    const fromBlock = Math.max(0, head - 500);
    const filter = base.filters.DistributeRequested(guid);
    const logs = await base.queryFilter(filter, fromBlock, head);
    if (logs.length > 0) {
      baseEvent = logs[0];
      baseTxHash = (logs[0] as ethers.EventLog).transactionHash;
      console.log(`  ✓ DistributeRequested received in block ${(logs[0] as ethers.EventLog).blockNumber}`);
      console.log(`  Base tx: ${baseTxHash}`);
      break;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 10_000));
  }

  console.log("");

  const artifact = {
    spike: "09-lz-bridge",
    runAt: new Date().toISOString(),
    src: { chain: "0G Galileo", chainId: 16602, eid: 40428, messenger: ogMessengerAddr, txHash: tx.hash },
    dst: { chain: "Base Sepolia", chainId: 84532, eid: 40245, messenger: baseMessengerAddr, txHash: baseTxHash },
    payload: { bountyId: bountyId.toString(), recipients, amounts: amounts.map((a) => a.toString()) },
    fee: { nativeFee: fee.nativeFee.toString(), lzTokenFee: fee.lzTokenFee.toString() },
    guid,
    delivered: !!baseEvent,
    layerZeroScan: `https://testnet.layerzeroscan.com/tx/${tx.hash}`,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-09.json"), JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: docs/spike-artifacts/spike-09.json`);

  console.log("\n=== Go/No-go Gate ===");
  console.log(`Send tx confirmed:    ${tx.hash ? "✅" : "❌"}`);
  console.log(`Peers wired both ways: ${ogToBasePeer !== ethers.ZeroHash && baseToOgPeer !== ethers.ZeroHash ? "✅" : "❌"}`);
  console.log(`Base event received:   ${baseEvent ? "✅" : "⏳ still in flight (LZ DVN may take a few minutes)"}`);

  if (baseEvent) {
    console.log("\n✅ Spike 9 PASS — LayerZero V2 cross-chain message delivered end-to-end.");
  } else {
    console.log(
      "\n🟡 Spike 9 PARTIAL — send confirmed on 0G; Base delivery still pending. Re-run with the same GUID later or check LZ Scan link.",
    );
  }
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 9 failed:");
  console.error(err);
  process.exit(1);
});
