/**
 * Extract all real tx hashes from Bounty 20 (Spike 18 PASS) contract events.
 * Used to populate frontend demo-data.ts with authentic on-chain data.
 *
 *   pnpm exec tsx --env-file=.env scripts/extract-bounty20-txs.ts
 */
import { ethers } from "ethers";

const RPC = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
const BOUNTY_ADDR = "0xebdf9FBAcb3172d2441FB7E067EFAB143F7F4eD8";

// All Bounty events we care about (lifecycle transitions).
const ABI = [
  "event PlannerAssigned(uint256 indexed plannerAgentId, address indexed plannerWallet)",
  "event SubTasksBroadcast(uint8 count)",
  "event BidPlaced(uint8 indexed subTaskIndex, uint256 indexed agentId, uint256 price)",
  "event BidAwarded(uint8 indexed subTaskIndex, uint256 indexed agentId, uint256 price)",
  "event FindingsSubmitted(uint8 indexed subTaskIndex, uint256 indexed agentId, bytes32 findingsRoot)",
  "event ClaimReviewed(uint8 indexed subTaskIndex, uint256 indexed criticAgentId, bool approved, string reasonURI)",
  "event SynthesisComplete(uint256 indexed synthesizerAgentId, bytes32 reportRoot)",
];

// Look these up too:
const FACTORY = process.env["OG_BOUNTY_FACTORY"] ?? "";
const MESSENGER = process.env["OG_BOUNTY_MESSENGER"] ?? "";
const FACTORY_ABI = [
  "event BountyCreated(address indexed bountyAddress,address indexed user,uint256 indexed bountyId,uint256 budget,string goalURI,bytes32 goalHash)",
];
const MESSENGER_ABI = [
  "event CompletionSent(uint256 indexed bountyId, bytes32 indexed messageGuid, uint64 nonce, uint32 dstEid, address[] recipients, uint256[] amounts)",
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract(BOUNTY_ADDR, ABI, provider);

  console.log(`Extracting events from Bounty ${BOUNTY_ADDR}\n`);

  const fromBlock = 0;
  const toBlock = await provider.getBlockNumber();

  const eventNames = [
    "PlannerAssigned",
    "SubTasksBroadcast",
    "BidPlaced",
    "BidAwarded",
    "FindingsSubmitted",
    "ClaimReviewed",
    "SynthesisComplete",
  ];

  const allEvents: { name: string; args: any; tx: string; blockNumber: number; timestamp?: number }[] = [];

  for (const ev of eventNames) {
    try {
      const filter = c.filters[ev]!();
      const logs = await c.queryFilter(filter, fromBlock, toBlock);
      for (const log of logs) {
        if ("args" in log) {
          allEvents.push({
            name: ev,
            args: (log as any).args,
            tx: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
      }
    } catch (err) {
      console.log(`  ${ev}: failed (${(err as Error).message.slice(0, 60)})`);
    }
  }

  // BountyFactory: find the BountyCreated event for bountyId 20
  if (FACTORY) {
    try {
      const fc = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
      const logs = await fc.queryFilter(fc.filters.BountyCreated!(BOUNTY_ADDR));
      for (const log of logs) {
        if ("args" in log) {
          allEvents.push({
            name: "BountyCreated",
            args: (log as any).args,
            tx: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
      }
    } catch (err) {
      console.log(`  BountyCreated: failed (${(err as Error).message.slice(0, 80)})`);
    }
  }
  // BountyMessenger: find CompletionSent for bountyId 20
  if (MESSENGER) {
    try {
      const mc = new ethers.Contract(MESSENGER, MESSENGER_ABI, provider);
      const logs = await mc.queryFilter(mc.filters.CompletionSent!(20n));
      for (const log of logs) {
        if ("args" in log) {
          allEvents.push({
            name: "CompletionSent",
            args: (log as any).args,
            tx: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
      }
    } catch (err) {
      console.log(`  CompletionSent: failed (${(err as Error).message.slice(0, 80)})`);
    }
  }

  // Get block timestamps to compute deltas
  const uniqueBlocks = [...new Set(allEvents.map((e) => e.blockNumber))];
  const blockTimes = new Map<number, number>();
  for (const b of uniqueBlocks) {
    const blk = await provider.getBlock(b);
    if (blk) blockTimes.set(b, blk.timestamp);
  }
  for (const e of allEvents) {
    e.timestamp = blockTimes.get(e.blockNumber);
  }

  // Sort by block, then by event name (create-time order)
  allEvents.sort((a, b) => a.blockNumber - b.blockNumber);

  if (allEvents.length === 0) {
    console.log("⚠ No events found. Check contract address / RPC.");
    return;
  }

  const t0 = allEvents[0]!.timestamp ?? 0;
  console.log(`Found ${allEvents.length} events. Reference t0 = block ${allEvents[0]!.blockNumber}.\n`);

  for (const e of allEvents) {
    const dt = (e.timestamp ?? 0) - t0;
    const args = Object.entries(e.args ?? {})
      .filter(([k]) => isNaN(Number(k))) // drop indexed numeric duplicates
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    console.log(`+${dt.toString().padStart(4)}s  ${e.name.padEnd(22)} tx=${e.tx}  ${args}`);
  }

  // Output as JS object literal for direct paste into demo-data.ts
  console.log("\n\n--- copy into demo-data.ts ---\n");
  console.log("export const txHashes: Record<string, string> = {");
  const seen = new Set<string>();
  for (const e of allEvents) {
    const key = e.name === "BidPlaced" ? `bidPlaced_${e.args.subTaskIndex}_${e.args.bidderAgentId}` :
                e.name === "BidAwarded" ? `awardBid_task${e.args.subTaskIndex}` :
                e.name === "FindingsSubmitted" ? `submitFindings_task${e.args.subTaskIndex}` :
                e.name === "ClaimReviewed" ? `reviewClaim_task${e.args.subTaskIndex}` :
                e.name === "SubTasksRegistered" ? "broadcastSubTasks" :
                e.name === "SynthesisSubmitted" ? "submitSynthesis" :
                `${e.name}_${e.tx.slice(2, 8)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${key}: "${e.tx}",`);
  }
  console.log("};");
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
