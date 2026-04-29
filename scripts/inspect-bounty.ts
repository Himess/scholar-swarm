/**
 * Inspect a Spike 18 bounty's on-chain state.
 *   pnpm exec tsx --env-file=.env scripts/inspect-bounty.ts <bountyAddress>
 */
import { ethers } from "ethers";

const RPC = process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";

const ABI = [
  "function status() view returns (uint8)",
  "function subTaskCount() view returns (uint256)",
  "function getSubTask(uint8) view returns (tuple(uint8 index, string description, uint256 awardedTo, uint256 awardedPrice, bytes32 findingsRoot, bool criticApproved, uint8 retryCount))",
];

const STATUS_NAMES = ["Open", "Planning", "Bidding", "Researching", "Reviewing", "Synthesizing", "Completed", "Cancelled"];

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function inferState(t: any): string {
  if (Number(t.awardedTo) === 0) return "Open (no award)";
  if (t.findingsRoot === ZERO_HASH) return "Awarded (waiting for findings)";
  if (t.criticApproved) return "Approved";
  return `Submitted/Reviewed (criticApproved=false, retryCount=${t.retryCount})`;
}

async function main(): Promise<void> {
  const addr = process.argv[2];
  if (!addr) throw new Error("usage: inspect-bounty.ts <address>");
  const provider = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract(addr, ABI, provider) as any;

  const status = Number(await c.status());
  console.log(`Bounty ${addr}`);
  console.log(`  status: ${status} (${STATUS_NAMES[status] ?? "?"})`);

  try {
    const count = Number(await c.subTaskCount());
    console.log(`  subTaskCount: ${count}`);
    for (let i = 0; i < count; ++i) {
      try {
        const t = await c.getSubTask(i);
        console.log(`  task ${i}: ${inferState(t)} awardedTo=agent#${t.awardedTo} retryCount=${t.retryCount}`);
        console.log(`    desc: ${String(t.description).slice(0, 80)}…`);
        if (t.findingsRoot !== ZERO_HASH) {
          console.log(`    findings: ${t.findingsRoot}`);
        }
      } catch (err) {
        console.log(`  task ${i}: getSubTask failed (${(err as Error).message.slice(0, 80)})`);
      }
    }
  } catch (err) {
    console.log(`  subTaskCount query failed: ${(err as Error).message}`);
  }
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
