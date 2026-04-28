# Day-by-day execution notes

**Author:** Semih Civelek (Himess)
**Purpose:** Chronological record of what happened each day, what blocked, what unblocked it, and which decisions got made on the fly. The git log shows *what* shipped; this file shows *why* the day went the way it did.

---

## Day -2 (~2026-04-22) — Idea selection

- 4-hour brainstorm session with Claude Web. Evaluated ~15 hackathon ideas:
  - VARdict (football referee debate swarm) — too consumer, no sponsor fit
  - AgentDeal (sealed-bid auctions on FHE) — overlaps my SealTender bounty
  - Encrypted Deliverable (privacy-preserving freelance) — single-sponsor
  - Scholar Swarm — picked
- Decisive factor: 0G + AXL + KH map cleanly to (compute, mesh, payment) without forcing fit. ([decision-log D1](./decision-log.md))
- Wrote v1 brief that evening on desktop (`PROJECT_BRIEF.md`).

## Day -1 (2026-04-23) — v1 review + revision

- Sent v1 brief to Claude Code for honest critique. Got back 5 red flags ([summary](./claude-code-feedback-v1.md)).
- Spent the day rewriting → `PROJECT_BRIEF_v2.md` addressing each flag in Section 0.
- Key concession: scope crept by ~2 days (added 2nd Researcher + Hetzner machine + retrieval layer) but each addition is necessary for the pitch to be honest, not theatre.
- Locked v2 in the evening; sent to Claude Code for second review.

## Day 0 (2026-04-24) — Spikes as binary gates

- Claude Code green-lit v2 ([summary](./claude-code-feedback-v2.md)).
- Ran Day-0 spikes in priority order: 1 (0G Compute), 5 (0G Storage), 4 (KH Direct Exec), 2a (AXL local), 3 (MCP-over-AXL).
- All 5 PASSed by end-of-day. Documented real model name (`qwen2.5-7b-instruct`) — v1 had hallucinated it as `qwen3.6-plus`.
- Surprise: KH responded `Unsupported network: 0g` to a chain query. That confirmed the cross-chain layer can't just be KH on 0G — needs real cross-chain. Filed for Day 4.

## Day 1 (2026-04-25) — Monorepo scaffolding

- `pnpm-workspace`, 11 packages stubbed: `swarm-sdk`, `og-client`, `axl-client`, `keeperhub-client`, `mcp-tools`, `shared`, plus 4 agent apps + frontend.
- `swarm-sdk/src/providers.ts` — wrote the abstract interface set (Inference, Storage, Messaging, Payment, Retrieval, Reputation). This is *the* design contract; everything downstream conforms to it. Wrote it carefully, not generated.
- `tsconfig.base.json` shared config. ESLint via TypeScript ESLint, Prettier opinionated.

## Day 2 (2026-04-26) — Sponsor reference + 0G docs archive

- Wrote `docs/sponsor-reference.md` (~500 lines) — exact-quote prize criteria for 0G dual-track + Gensyn + KH, then mapped each to specific files in our repo.
- Archived 508 KB of 0G docs (`docs/og-llms-full.txt`) for offline reference. Saved hours later when 0G's docs site went down twice during the hackathon.

## Day 3 (2026-04-27 morning) — Contracts + first deploys

- 6 Solidity contracts written (AgentNFT, ReputationRegistry, ArtifactRegistry, Bounty, BountyFactory, PaymentRouter). 34 Foundry tests written same day, all green.
- Hit "stack too deep" in `ReputationRegistry.readAllFeedback`. Fix: enable `via_ir = true` in foundry.toml, moved foundry config from project root to `contracts/` so the IR pipeline applies cleanly.
- Hit Diamond inheritance conflict on `IERC7857Metadata` + `IIdentityRegistry` — both declared `getMetadata`/`setMetadata` with same signatures. Fix: dropped IERC7857Metadata from IAgentNFT inheritance and consolidated.
- Deployed 6 contracts on 0G Galileo + PaymentRouter on Base Sepolia. ~0.038 OG total deploy cost.
- Spike 1 + 4 first runs PASSED on real testnets — TEE attestation verified, KH paid out USDC on Base.

## Day 3 (2026-04-27 afternoon → Day 4 same calendar day) — Adapters + agent runtimes

- Wrote 3 adapters: `og-client` (inference + storage), `axl-client` (messaging via local HTTP), `keeperhub-client` (REST PaymentProvider + MCP Streamable HTTP client).
- Wrote 4 agent runtimes (Planner, Researcher, Critic, Synthesizer) with `Role` subclasses. Each implements `handle(msg)` over the SwarmMessage discriminated union.
- Hit 0G SDK 0.7.5 quirk — `listService()` returns `ethers.Result` tuples, not named props. Wrote `normalizeService()` that does index access.
- Spike 8 (KeeperHub MCP Streamable HTTP) PASS. 26 tools listed. KH MCP became canonical surface for orchestration calls.

## Day 4 (2026-04-27 evening) — LZ V2 OApps written + iNFT minting

- Wrote `BountyMessenger.sol` (0G side) + `PaymentMessenger.sol` (Base side). Both compile clean against `@layerzerolabs/oapp-evm`.
- Verified LZ V2 endpoints are LIVE on both chains via the official LZ metadata API. EID 40428 (0G) and 40245 (Base). DVN: LayerZero Labs.
- 5 iNFTs minted to AgentNFT contract on 0G Galileo. AES-256-GCM encrypted intelligence per agent, merkle root committed via ERC-7857.
- README v1 written. Got Claude Web feedback that it was "buzzword salad" → restructured as story-first ("AutoGPT for serious research"), infrastructure detail below the fold. ([decision-log D5](./decision-log.md))

## Day 5 (2026-04-27 night) — LZ deploy + cross-chain message + operator wallets + royalty

- Deployed `BountyMessenger` (0G) and `PaymentMessenger` (Base). Wired peers via `WirePeers.s.sol`.
- Spike 9 PASS — first cross-chain message 0G → Base. GUID `0x565ff853…`, ~40s latency, real DVN attestation. *No trusted relayer in the path.*
- Generated 5 fresh operator wallets via `ethers.Wallet.createRandom()`. Funded them from the deployer + transferred each iNFT (#1–5) to its respective operator. The "different operators" pitch is now on-chain truth.
- Deployed `AgentRoyaltyVault` with 95/5 owner/creator split. Spike 10 PASS — 0.002 OG payment routed correctly.

## Day 6 (2026-04-27 late night → 2026-04-28 early morning)

- Topped up Synthesizer wallet with extra OG (LZ fees can hit 0.35 OG per message — discovered the hard way via INSUFFICIENT_FUNDS in spike-12).
- Spike 11 PASS — full Bounty lifecycle E2E across 7 distinct signers (16 txs). First time all state transitions hit on-chain in one test.
- Spike 12 PASS — Synthesizer signs `notifyCompletion`, LZ delivers, Base emits `DistributeRequested`. End-to-end pipeline verified, but *Synthesizer agent runs the LZ tx* — feels like a "trustless agent + bot" hybrid. Mark for refactor on Day 7.
- Spike 13 PASS — drafted KH workflow via MCP `ai_generate_workflow`. Hit 422 input-validation: tool expects `prompt`, not `description`. Fixed wrapper, second call returned 6-op workflow draft.
- Spike 14 PASS — `create_workflow` persisted the workflow on the org. id: `nepsavmovlyko0luy3rpi`. KH is now watching `DistributeRequested` events on Base and will auto-fire `PaymentRouter.distribute()`.
- Wrote `docs/hetzner-setup.md` for Day 8 VPS provisioning.

## Day 7 (2026-04-28) — Bounty auto-fires LZ + Tavily + full E2E

This was the day the architecture got its strongest correction. Three things shipped:

### A. Tavily retrieval

- `packages/mcp-tools/src/tavily.ts` — concrete `RetrievalProvider` impl, search + fetchUrl.
- Found and fixed a bug in Researcher: it was passing `"bounty X task Y"` to retrieval.search() instead of the actual sub-question text. Now passes the real query.
- Spike 15 written (smoke test). Awaits TAVILY_API_KEY to run real fetch.

### B. Bounty.submitSynthesis fires LZ atomically

The big architectural correction. Previously the synthesizer agent had to:
1. Call `submitSynthesis(reportRoot)` on Bounty,
2. Then separately call `BountyMessenger.notifyCompletion(...)` with msg.value=lzFee.

Two transactions, two trust points, the off-chain script picks up the slack. Wrong shape.

**Refactor:** Made `Bounty.submitSynthesis` `payable` and added optional `configureSettlement(messenger, bountyId, plannerFee, criticFee, synthesizerFee)` that the factory calls once at clone time. On the synthesis call, if a messenger is wired, `submitSynthesis` builds the recipients/amounts vector from on-chain state and calls `notifyCompletion{value: msg.value}` in the same tx as the status flip to Completed.

Backward-compatible: if `bountyMessenger == address(0)` (e.g. existing tests), submitSynthesis stays a pure state-machine call. All 42 Foundry tests still pass with the change. ([decision-log D4](./decision-log.md))

Deployed new Bounty impl + new BountyFactory (V2) + transferred BountyMessenger ownership to the new factory so it can auto-authorize new bounties at creation. Old V1 contracts kept as archive.

**Spike 16 PASS** — `pnpm spike:16` walks the full lifecycle on the V2 factory. The synth's single tx atomically fires LZ. GUID `0x6cfdf46b…`.

#### Debug story — `Transfer_NativeFailed`

First three runs of spike-16 reverted with `Transfer_NativeFailed(address, uint256)`. I traced through:
- `cast 4byte 0x465bc834` → identified the LZ V2 selector.
- The address arg was the Bounty contract; the amount was `nativeFee - msg.value` worth of dust.
- LZ V2 OApp `_lzSend` was trying to refund excess `msg.value` to the Bounty contract, which has no `receive() payable`. Refund failed → revert.
- I considered adding `receive()` to Bounty (would have worked) but read OApp source and discovered `_payNative` enforces `msg.value == nativeFee` strict equality — so a "buffer" was actually impossible. The fix wasn't `receive()`, it was *send the exact quoted fee, no buffer*.
- Changed `lzFee = (fee.nativeFee * 110n) / 100n` → `lzFee = fee.nativeFee` and the run passed.

This was a Semih-driven debug, not AI. Took ~30 minutes to find the right answer.

### C. Full E2E orchestrator

Wrote `scripts/spike-17-full-e2e.ts` — single script, end-to-end with real providers:
- 7 attested 0G Compute inferences (3 researcher + 3 critic + 1 synthesizer)
- 7 0G Storage merkle-rooted blob commits (findings + critic rationale + final report)
- Full bounty lifecycle on V2 contracts
- LZ V2 fired atomically on synthesis. GUID `0x82fcb3f2…`.
- Tavily integration plug-in: real if `TAVILY_API_KEY` set, stub otherwise. Researcher logs which mode.

This is the demo video script. ~4 minutes runtime against live testnet.

### D. Documentation pass

- README synced to Day 7 reality. Status table now lists all 15 PASS spikes + the 1 pending (Hetzner) + the 1 awaiting key (Tavily).
- This `docs/ai-collaboration/` folder created in response to ETHGlobal's AI usage rules.

---

## Day 9 (2026-04-28 evening, into early hours of Apr 29) — Spike 18

The longest single sprint of the build. Started from a working single-process orchestrator (Spike 17) and ended with five real OS processes coordinating one bounty end-to-end over the AXL mesh.

What we shipped:
- `axl-client/messaging.ts` rewritten to match the real AXL HTTP API (verified Day 8 against the EU VPS — /send wants `X-Destination-Peer-Id` header, /recv is POST + single-message POP, /topology peers are objects). Added a `staticPeers` config because Yggdrasil's spanning tree from a leaf node only sees the parent, and broadcast() needs to know every agent's pubkey to actually reach the swarm.
- `swarm-sdk/providers.ts` extended with `ChainAdapter` interface — the on-chain coordination contract. Each agent runtime owns one, signing with its own operator wallet.
- `og-client/chain.ts` — `EVMChainAdapter` impl (ethers v6 + Bounty/Factory/Messenger ABIs). Bounty state-machine ops (acceptPlanner, broadcastSubTasks, placeBid, awardBid, submitFindings, reviewClaim, submitSynthesisAndFireLZ) all map to single methods.
- `apps/agent-*/src/role.ts` updates: each role now calls `ctx.providers.chain.<op>` directly. PlannerRole's onBountyBroadcast does broadcastSubTasks + sets a 120s bid window; ResearcherRole does placeBid + submitFindings; CriticRole does reviewClaim with sub-account / semantic-check bypass on graceful failures; SynthesizerRole tracks approvals and on the third one runs synthesis + fires LZ via chain.submitSynthesisAndFireLZ.
- `apps/agent-*/src/index.ts` rewired to instantiate ChainAdapter + SearxRetrievalProvider + AXLMessagingProvider with staticPeers list.
- `infra/axl-node-{planner,r1,r2,critic,synth}/` — five separate AXL identity dirs, each with its own private.pem + node-config.json. Planner is the listener at `tls://127.0.0.1:9201`; the other four dial in.
- `scripts/spike-18-launch.ts` — Node.js spawner for the 5 AXL nodes + 5 agent runtimes, with colored per-process log streams.
- `scripts/spike-18-cli.ts` — the user side: createBountyWithSettlement → acceptPlanner → broadcast `bounty.broadcast` to the planner → poll on-chain status until Completed → fetch the final report from 0G Storage.
- `scripts/spike-18-bootstrap-inference.ts` — one-shot per-wallet 0G Compute setup. Three additional 5-OG donor wallets came in mid-day, just barely covering the broker's 3-OG-per-ledger floor × 5 agents.

Bugs found and fixed during the run:
1. **0G broker ESM bundle bug.** `@0glabs/0g-serving-broker@0.7.5` ships a broken `lib.esm/index.mjs` (`does not provide an export named 'C'`). Fixed by removing `"type": "module"` from `apps/agent-*/package.json`, forcing CJS resolution which uses the working `lib/index.js` bundle.
2. **`pnpm.cmd` not on the spawned shell PATH.** The launcher's spawn() inherits Git Bash PATH which doesn't include the user's npm prefix. Fixed by spawning Node directly with the absolute tsx-cli path.
3. **acceptPlanner is `msg.sender == user`-only.** The Planner agent can't call it (only the bounty creator can). Solved by having the User CLI call acceptPlanner before broadcasting `bounty.broadcast`.
4. **Static peer list.** Yggdrasil tree convergence is partial; broadcast() iterating /topology only reached the planner from R1's perspective. Added `staticPeers` config to AXLMessagingProvider — every agent runtime injects all 5 agent pubkeys, ensuring broadcasts reach the entire swarm.
5. **`bountyAddress` propagation.** User CLI sends `bounty.broadcast` only to the planner. Researchers/critic/synth never saw the address. Fix: `subtask.broadcast` now carries `bountyAddress` and other roles cache it on receipt.
6. **`BID_WINDOW_MS = 120 s`.** First pass had 8 s default (in-process testing assumption). Each researcher places 3 sequential placeBids, ~10-15 s each on testnet. 75s window failed (task 2 unbid); 120 s works with margin.
7. **Operator wallet OG drain.** Multiple failed runs depleted operator OG balances. Bumped `topup-operators.ts` to take env-var targets and re-funded via the donor sweep.

The successful run: bounty 20 at `0xebdf9FBA…`, 16 chain txs from 5 distinct signers, 6.5 minutes wall-clock from createBountyWithSettlement to submitSynthesis-fires-LZ. GUID `0x0c6eb88031ea51b3eaa6c6cbb10fab7fcc419eefc4262925ecd29e284985a6ad`.

## Day 8+ (2026-04-29 onwards) — pending

| Day | Date | Plan |
|---|---|---|
| 8 | 2026-04-29 | Hetzner CX22 provisioning + Spike 2b cross-ISP mesh; Tavily key set + Spike 15/17 with real sources |
| 9 | 2026-04-30 | Single-machine E2E dry run with all real providers; frontend polish |
| 10 | 2026-05-01 | Two-machine demo dry run (laptop TR + Hetzner DE) |
| 11 | 2026-05-02 | Demo video record + README final polish + sponsor pitches + KH FEEDBACK.md |
| 12 | 2026-05-03 | Submit (deadline 19:00 TR / 12:00 ET) |

---

## Numbers as of Day 7 end

- 11 contracts deployed on two chains (9 on 0G, 2 on Base)
- 17 spike scripts; 15 PASS, 1 pending (Hetzner), 1 awaiting Tavily key
- 42 Foundry tests, all green
- 22 GPG-signed commits, every push auto-deployed nothing (pure repo, no servers running yet)
- ~6.5 OG burned across all on-chain activity — well within faucet allotment
- Solo: just me. ~80-100 hours invested by Day 7.
