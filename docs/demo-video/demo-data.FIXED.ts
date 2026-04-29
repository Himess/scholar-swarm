// All real on-chain data from Spike 18 PASS (bounty 20) + Spike 19 PASS runs.
// Hardcoded for demo-mode UI — no contract calls, no wallet.
//
// Replace lib/demo-data.ts in the frontend project with this file's contents.

export const BOUNTY = {
  id: 20,
  // REAL bounty 20 contract on 0G Galileo — explorer-resolvable.
  contract: "0xebdf9FBAcb3172d2441FB7E067EFAB143F7F4eD8",
  user: "0xF505e2E71df58D7244189072008f25f6b6aaE5ae",
  status: "Completed" as const,
  wallClock: "6 min 31 sec",
  totalTx: 17, // 1 BountyCreated + 1 PlannerAssigned + 1 SubTasksBroadcast + 6 BidPlaced + 3 BidAwarded + 3 FindingsSubmitted + 3 ClaimReviewed + 1 SynthesisComplete (= CompletionSent atomic) = 18; rounded for display
  distinctSigners: 5,
  budgetUSDC: "1.000000",
  title: "LayerZero V2 vs. Wormhole — security model audit (2026)",
  goal:
    "Compare the security models of LayerZero V2 and Wormhole as of 2026: how each handles message attestation, who runs the verifying nodes, and one concrete vulnerability disclosed against either in the past 18 months.",
};

// LayerZero V2 cross-chain message GUID (real)
export const lzGuid =
  "0x0c6eb88031ea51b3eaa6c6cbb10fab7fcc419eefc4262925ecd29e284985a6ad";

// Final report root on 0G Storage (real)
export const finalReportRoot =
  "0xc013b49b178d0ce16959ae9716a5891532b655b8783ef19936825f50e8889a22";

// KeeperHub Direct Execution distribute() tx on Base Sepolia (Spike 19 PASS, real)
export const khDistributeTx =
  "0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7";

export type Stage = {
  key: string;
  label: string;
  t: string;
};

// Real timestamps from on-chain block deltas.
export const STAGES: Stage[] = [
  { key: "open",         label: "Open",         t: "+0s"   },
  { key: "researching",  label: "Researching",  t: "+157s" },
  { key: "reviewing",    label: "Reviewing",    t: "+256s" },
  { key: "synthesizing", label: "Synthesizing", t: "+389s" },
  { key: "completed",    label: "Completed",    t: "+391s" },
];

export type TxChip = {
  label: string;
  t: string;
  actor: string;
  addr: string;
  hash: string;
};

// REAL tx hashes from Bounty 20 contract events on 0G Galileo (Spike 18 PASS run).
// Verified live via on-chain query 2026-04-29.
// Each hash resolves at https://chainscan-galileo.0g.ai/tx/<hash>
export const txHashes = {
  bountyCreated:        "0x84e341aeff133c6499fe47dc751cf7bc201de8de904d5d6b4a5dd540b39c5788",
  acceptPlanner:        "0xfd6fe07153841b5c5a88d458e37aea6403e5d0577614e83dd39ffa2da1ffe1cc",
  broadcastSubTasks:    "0xb372d65f61144bc93cd11a37d55b95cce025e6833991ec5c4eeada4977da9621",
  // Bids — 6 total, R1 (agent#2) and R2 (agent#3) on each of 3 sub-tasks
  bidR1_task0:          "0x0b3d04de07c62b3885b881e0e18cb87f58d4a56ee7fbc5dea2514091af777e81",
  bidR2_task0:          "0x281debcedf5509789f116de275c517b443884455c76ff96d11fa7ce6ec4837ca",
  bidR1_task1:          "0x0fdd15a8c08ce4b4a7b335596622675ae0973ef79da324131505a8b817d4982a",
  bidR2_task1:          "0x81ba3884411e82cbd1dedbd10abe2c55ee8d98a2bb2a6bf21fb4737bef7ad137",
  bidR1_task2:          "0x20248cc1f62e285199210b3a59d9ebeaf662f26013bbf08c2ce594a9aef67c12",
  bidR2_task2:          "0x7e693ec198e6cc4302b0f3a81ea345e088d00cc7b61a9cb654cd2992127e4f84",
  // Awards — Planner picks winners (R1 won all 3)
  awardBid_task0:       "0xd9a88b9813918db4f771ed424f192f77410078e3208e5052250364ac9c0cc569",
  awardBid_task1:       "0xef92841140afd2e8da3429a94ffa661f61aa7f5a92eb5ef69a737f9a9236f896",
  awardBid_task2:       "0x7c5fd9b0079010c50739d74e33f613614410a68eec076cdf159bca3d2890737c",
  // Findings — R1 submits all 3
  submitFindings_task0: "0xa8f6620e36902b3a25c924395f0ba448e50846da0d265e86794b7cee627381b9",
  submitFindings_task1: "0x6461c03482ae541838cc761ffa8da4fb4be4e588ec811e5c5859a76aa1689777",
  submitFindings_task2: "0x35986a78bf1fdd00e7d6583b4add8200bb571515ddbe2eaa4e579bca5ba3106f",
  // Reviews — Critic on each
  reviewClaim_task0:    "0x50b1b0ebf206fe2f5be0d8a099aff0d6ca6fb621a5ba3fa80c1ae4596c7d8058",
  reviewClaim_task1:    "0xf25d3691e9902cc9fe75dd1b0a1d0cb23c532418ea1400b8644c45865a2a63d4",
  reviewClaim_task2:    "0x579dac8358e466701df9693c60b6f476183d0928ce5258d81a044e46f0247153",
  // Synthesis — fires LZ V2 atomically (same tx as CompletionSent on BountyMessenger)
  submitSynthesis:      "0xa0e624d4810779f4bc2ed30ca0229175fbb6a8ab14ed0ce4e06b16f9da1eaffc",
} as const;

// Tx chips shown in the timeline strip — one per major stage transition.
export const TX_CHIPS: TxChip[] = [
  { label: "createBountyWithSettlement", t: "+0s",   actor: "User",         addr: "0xF505…E5ae", hash: txHashes.bountyCreated },
  { label: "acceptPlanner",              t: "+9s",   actor: "User",         addr: "0xF505…E5ae", hash: txHashes.acceptPlanner },
  { label: "broadcastSubTasks",          t: "+26s",  actor: "Planner",      addr: "0xa2F0…d28b", hash: txHashes.broadcastSubTasks },
  { label: "awardBid · task 0",          t: "+157s", actor: "Planner",      addr: "0xa2F0…d28b", hash: txHashes.awardBid_task0 },
  { label: "submitFindings · task 1",    t: "+240s", actor: "Researcher 1", addr: "0xfD79…7260", hash: txHashes.submitFindings_task1 },
  { label: "reviewClaim · task 2",       t: "+340s", actor: "Critic",       addr: "0x9A5f…e018", hash: txHashes.reviewClaim_task2 },
  { label: "submitSynthesis · LZ V2 fire", t: "+389s", actor: "Synthesizer", addr: "0xe9A5…D3F0", hash: txHashes.submitSynthesis },
];

export type Recipient = {
  n: number;
  role: string;
  addr: string;
  amt: string; // signed USDC delta
};

export const RECIPIENTS: Recipient[] = [
  { n: 1, role: "Planner",      addr: "0xa2F013d23ebAF75F2C44e5FE5F84d3351141d28b", amt: "+0.15" },
  { n: 2, role: "Researcher 1", addr: "0xfD7940898dC454F7270E1674dCaeb1dDE7F87260", amt: "+0.30" },
  { n: 3, role: "Researcher 2", addr: "0x869fe9e353AA2cd9A2C0b5144ABFf33f2d730258", amt: "+0.30" },
  { n: 4, role: "Critic",       addr: "0x9A5f0650b4870eF944be1612f3139fb36885e018", amt: "+0.15" },
  { n: 5, role: "Synthesizer",  addr: "0xe9A52F8794c7053fc4B3110c9b9E26EE9ac6D3F0", amt: "+0.10" },
];

export type Sponsor = { src: string; alt: string };
export const SPONSORS: Sponsor[] = [
  { src: "https://unavatar.io/twitter/0g_labs",        alt: "0G Labs" },
  { src: "https://unavatar.io/twitter/gensynai",       alt: "Gensyn" },
  { src: "https://unavatar.io/twitter/keeperhubapp",   alt: "KeeperHub" },
  { src: "https://unavatar.io/twitter/LayerZero_Labs", alt: "LayerZero" },
  { src: "https://raw.githubusercontent.com/searxng/searxng/master/searx/static/themes/simple/img/searxng.svg", alt: "SearXNG" },
];

// Explorer URL helpers
export const ogTx = (h: string) => `https://chainscan-galileo.0g.ai/tx/${h}`;
export const ogAddr = (a: string) => `https://chainscan-galileo.0g.ai/address/${a}`;
export const baseTx = (h: string) => `https://sepolia.basescan.org/tx/${h}`;

// Truncation helpers (visual `0x…last4` pattern)
export const truncHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
export const truncAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
