# Architectural Decision Log

**Author:** Semih Civelek
**Convention:** Every decision listed here was made by me (Semih), not by an AI tool. Each entry says *what* the decision was, *what alternatives were considered*, *why* this option won, and *when* it was made. AI tools (Claude Web for brainstorm, Claude Code for implementation) gave me input; I made the calls.

> **For ETHGlobal judges:** This file exists because the rules require evidence that the human contributed meaningful direction, not just prompts. Each "Made by: Semih" line is honest — read the corresponding [`day-by-day-notes.md`](./day-by-day-notes.md) entry for context.

---

## D1 — Project selection: Scholar Swarm

**Decision:** Build a multi-agent research swarm (Scholar Swarm) for ETHGlobal Open Agents.
**Alternatives considered:**
- VARdict — football referee debate swarm. Rejected: too consumer, no clean sponsor mapping.
- AgentDeal — sealed-bid auctions on FHE. Rejected: overlaps my prior SealTender bounty submission.
- Encrypted Deliverable — privacy-preserving freelance escrow. Rejected: single-sponsor (Zama), narrow.
- 6+ other ideas evaluated and rejected.
**Why this one:**
- Best sponsor fit. 0G (compute + storage), Gensyn AXL (mesh), KeeperHub (payment) each map cleanly to a separate architectural layer with no forced fit.
- No overlap with my previous work (MARC, SealTender, PrivAgent, Pendex).
- The "AutoGPT for serious research" pitch has a credible enterprise customer (hedge funds, journalists, due-diligence teams).
- Solo-buildable in 12 days if scope is disciplined.
**Made by:** Semih, Day -2 (2026-04-22), after a 4-hour brainstorm session with Claude Web.

---

## D2 — Including iNFT (ERC-7857) in the MVP

**Decision:** Mint 5 iNFTs on 0G Galileo as core architecture, not a stretch goal.
**Alternatives considered:** Defer iNFTs to v2; ship MVP with plain agent EOAs.
**Why this:**
- 0G Agents track explicitly mentions iNFT novelty as a judging criterion.
- Marginal cost is low: a single `AgentNFT.sol` contract handles both ERC-7857 (the encrypted-intelligence interface) and ERC-8004 (the IdentityRegistry).
- Claim becomes verifiable on-chain — each agent has a unique NFT id, encrypted system prompt rooted at `intelligenceRoot`, and an owner EOA.
**Made by:** Semih, Day 4 (2026-04-27), after reading the 0G prize page on Day 2.

---

## D3 — LayerZero V2, not a trusted relayer, for cross-chain payout

**Decision:** Use LayerZero V2 OApp pattern for the 0G → Base message that triggers payout.
**Alternatives considered:**
- Trusted off-chain bot relayer ("the relayer") — simplest path, ~half a day to ship.
- CCIP — verified not deployed on 0G Galileo.
- Axelar — also not on 0G.
- Single-chain payment (drop Base, do everything on 0G) — would need wrapped USDC equivalent, not available.
**Why LZ V2:**
- KeeperHub's API explicitly rejects 0G chain (`Unsupported network: 0g` confirmed Day 3). So the payment side has to be on Base.
- A trusted relayer defeats the "trustless multi-agent" claim — that's the whole pitch of the project. Killing the relayer is non-negotiable for the demo to be honest.
- Verified on Day 4 via the LayerZero metadata API that V2 EndpointV2 contracts are deployed on both 0G Galileo (EID 40428) and Base Sepolia (EID 40245).
- KeeperHub keeps its role: it becomes the *Base-side execution layer* watching `DistributeRequested` events, not a coordinator.
**Made by:** Semih, Day 4 (2026-04-27), after KH's API confirmed 0G is unsupported.

---

## D4 — Bounty.submitSynthesis fires LZ atomically (V2 contract refactor)

**Decision:** Refactor `Bounty.sol` so `submitSynthesis` is `payable` and atomically calls `BountyMessenger.notifyCompletion{value: lzFee}` in the same transaction.
**Alternatives considered:**
- Keep two-step path: synthesizer agent calls submitSynthesis, then separately fires `notifyCompletion`. (This is what Spike 12 used.)
- Add a `BountyAutoFinalizer` helper contract that wraps both calls — keeps Bounty unchanged but adds a layer.
- Make the entire dispatch flow off-chain (a script that watches `SynthesisComplete` and fires LZ).
**Why the inline refactor:**
- Two-step path means an off-chain coordinator (the synthesizer's runtime) sits in the critical path. That contradicts the "no trusted relay" claim.
- Helper-contract path adds a second contract for callers to learn about. Worse UX.
- Off-chain script is the worst option — it's a glorified bot.
- Inline refactor is the only design where *the contract itself* is the cross-chain dispatcher. One tx, no bots, on-chain truth.
**Cost:** Required deploying new Bounty impl + new Factory + transferring messenger ownership. About 2 hours of work, including writing a backward-compat layer (legacy `createBounty` path still works, all 42 tests still pass).
**Made by:** Semih, Day 7 (2026-04-28), after Spike 12 demonstrated that the manual two-step path was working but architecturally weak.

---

## D5 — Pitch positioning: "AutoGPT for serious research"

**Decision:** Lead the README with a one-liner contrast to AutoGPT, structure the rest as a receipt-driven proof. Push infrastructure detail (chain IDs, contract addresses, OApp pairs) below the fold.
**Alternatives considered:**
- Lead with "decentralized research economy" framing — accurate but buzzword-heavy.
- Lead with sponsor stack ("0G + Gensyn + KH = ...") — judges have seen 50 of these and skim.
- Lead with the architecture diagram — too dense.
**Why "AutoGPT for serious research":**
- AutoGPT is a known reference point. Judges already understand the limits ("hallucinates sources"). Leading with it shortcuts ~3 paragraphs of setup.
- The contrast pivot ("we don't hallucinate") forces the next 3 mechanisms (real fetch / critic verify / TEE attest) to be receipts, not promises.
- Avoids buzzword salad — the post-Veil-VPN review pattern of "pick one hero story, technologies serve the story."
**Made by:** Semih, Day 4 (2026-04-27), after sharing v1 README with Claude Web and getting feedback that it read like a "buzzword salad."

---

## D6 — Apply for Finalist + Partner Prizes simultaneously

**Decision:** Submit for the Finalist track AND all 3 partner prizes (0G, Gensyn AXL, KeeperHub).
**Alternatives considered:**
- Apply only for partner prizes — original v2 brief plan, lower-risk.
- Apply only for Finalist — lower probability but bigger prize.
**Why both:**
- ETHGlobal explicitly allows it; a Finalist application doesn't reduce partner-prize odds.
- Top-20% project rate on previous Open Agents events; my Day-7 status (15/16 spikes PASS, 11 contracts on two chains, full E2E on testnet) puts the technical depth in the top tier.
- Worst case: Finalist denied, partner prizes still scored independently.
- Best case: stack the prize pool.
**Made by:** Semih, Day 7 (2026-04-28).

---

## D7 — Two physical machines for demo, not one

**Decision:** Demo runs on laptop (TR, NAT-ed residential ISP) + Hetzner CX22 VPS (Frankfurt, public IP). 5 distinct iNFT operator wallets. Cross-ISP AXL mesh visible in demo.
**Alternatives considered:**
- Single laptop running 5 processes. Cheaper, simpler, same code. But the "different operators" pitch then visibly contradicts the demo: one IP, one process tree, one wallet.
- Two laptops in same network. Same problem at a smaller scale.
**Why two physical, two ISPs:**
- The decentralization claim becomes verifiable visually. A judge running the demo sees real `peer_id` discovery across the public internet, not loopback.
- ~€5 cost, ~2-3 hours setup ([`docs/hetzner-setup.md`](../hetzner-setup.md) is ready). High leverage relative to the credibility gain.
**Made by:** Semih, Day 0 (2026-04-24), as part of v1→v2 brief revision.

---

## D8 — Story-first README; receipts inline; archive history below

**Decision:** README opens with the AutoGPT contrast + 3 mechanisms, then "How it works (one bounty, end-to-end)" diagram, then status table. Architecture / contracts / spikes / SDK position / repo layout / quick-start come after. Day-by-day appendix at the bottom.
**Alternatives considered:**
- Architecture-first (chain IDs, contract addresses, OApp pairs at the top).
- Sponsor-first (one section per sponsor explaining how each is used).
**Why story-first:**
- Judge skim time per project is ~60 seconds. The opening 200 words decide whether they keep reading.
- Receipts (tx hashes, GUIDs, contract addresses) inline beat a separate "proof" section — they're more credible right next to the claim.
- Status table near the top gives a quick "is this real" check without needing to read code.
**Made by:** Semih, Day 4 (2026-04-27), with structural input from Claude Web on hackathon README patterns.

---

## D9 — Sponsor track selection: 0G dual + Gensyn AXL + KeeperHub

**Decision:** 3 sponsor slots: 0G Labs (Best Agent Framework + Best Autonomous Agents/Swarms/iNFT — counts as one slot per ETHGlobal rules), Gensyn AXL, KeeperHub.
**Alternatives considered:**
- Pyth, Chainlink, Circle — all have prize pools, none map to architecture without forcing fit.
- World ID — was considered for sybil resistance but explicitly cut (out for MVP, v2 material).
- LayerZero — could apply but the AXL slot is more architecturally honest (mesh > bridge for our use).
**Why these three:**
- Each is architecturally essential: drop any one and the system breaks. That's the bar for sponsor track integrity.
- 0G dual covers $15k addressable. Gensyn $5k. KH $4.5k + $250 feedback bonus. Total addressable ~$24.75k.
**Made by:** Semih, Day 0 (2026-04-24), informed by `docs/sponsor-reference.md` which I wrote Day 2.

---

## D10 — Story-driven debugging when contracts revert

**Decision:** When a tx fails on testnet, trace the failure root cause before applying any fix. Specifically with `Transfer_NativeFailed` on Spike 16: identified LZ V2 OApp's strict-equality `_payNative`, sent exact quoted fee instead of a buffer. Did not add `receive()` to Bounty.
**Alternatives considered:**
- Add `receive() external payable {}` to Bounty so the refund flow works.
- Catch the revert in the script and retry with a different value.
**Why exact-fee:**
- Adding `receive()` would have worked but would also have left a contract able to silently accept ETH, which is a foot-gun. Better to force exact-fee discipline.
- The buffer was theoretically wrong anyway: OApp `_payNative` requires exact equality. The buffer was a pattern from EIP-1559 thinking that doesn't apply to LZ V2.
**Made by:** Semih, Day 7 (2026-04-28), after ~30 minutes of `cast 4byte 0x465bc834` + reading OApp source.

---

## D12 — Self-hosted SearXNG over Tavily as default retrieval

**Decision:** SearXNG runs in Docker on the EU VPS (bound to `127.0.0.1:8888`, reached over SSH tunnel). It's the default `RetrievalProvider`. Tavily stays as a swappable alternative for builds that prefer a hosted API.
**Alternatives considered:**
- Tavily (free tier 1000/mo) — what Claude Code initially recommended.
- Brave Search API (free tier 2000/mo) — same vendor-key shape as Tavily.
- DuckDuckGo HTML scraping — ToS gray area, brittle.
- Plain `fetch()` with seed URLs — drops the discovery story entirely.
- Wikipedia-only — too narrow.
**Why SearXNG:**
- Removes the third-party search API from the trustless multi-agent claim. The whole pitch is "no vendor sits in the critical path."
- The EU VPS already exists (Roil DevNet coexist, Spike 2b proved the integration). SearXNG runs there at ~100 MB RAM with the Canton stack and AXL node sharing the box.
- Federates Google / Bing / DuckDuckGo / Wikipedia / others under one JSON endpoint — multi-engine diversity for free.
- AGPL-3.0 open source — operationally inspectable.
- Same `RetrievalProvider` interface — agent code is unchanged when swapping.
**Cost:** ~30 minutes from "let's try" to Spike 15 PASS with real Google results.
**Made by:** Semih, Day 8 (2026-04-28), pushing back against AI's first instinct (Tavily).

---

## D13 — Multi-process AXL choreography (Option C, replace Spike 17 orchestrator)

**Decision:** Build Spike 18 — five independent Node.js processes (Planner, R1, R2, Critic, Synthesizer), each with its own AXL node and operator wallet, coordinating one bounty over the AXL mesh. Spike 17's single-process orchestrator stays in the repo as a fallback / SDK reference but Spike 18 is the hero demo.
**Alternatives considered:**
- A: don't build multi-process; Spike 17 IS the demo. Zero risk, no incremental investment.
- B: build Spike 18 as an additional spike, Spike 17 stays as primary demo. Hedge.
- C: this — Spike 18 is hero, Spike 17 demoted to orchestrator/fallback.
**Why C:**
- The pitch claims "five specialist iNFT agents...coordinate". Spike 17 with one orchestrator pretending to be 5 is architecturally a lie. Spike 18 makes the pitch true.
- Direct harm to other tracks: zero. (See conversation-log entry — multi-process *exercises* the framework, doesn't compete with it; KH integration is unchanged; Gensyn AXL track requires cross-node messaging which is exactly what this delivers.)
- Time budget: 5 days remaining. Day 9-10 implementation, Day 11 polish, Day 12 buffer + submit. Polish budget is intact.
- Worst case (Spike 18 breaks Day 10 evening): fall back to Spike 17 for demo video, lose ~$1k AXL placement upside.
**Specific risks:**
- AXL `/recv` POP semantics force one AXL node per agent (5 AXL nodes on laptop, different ports). Adds infra setup.
- AXLMessagingProvider was implemented against a wrong API shape — needs a rewrite to match real `/send` + `/recv` + `/topology`.
- Multi-process state coordination: Planner waits for all bids, Critic for all findings, Synth for all reviews. Solving via on-chain reads (auth) where possible, AXL liveness signals where convenient.
**Made by:** Semih, Day 8 (2026-04-28), pushing back against AI's conservative recommendation (Option A).

---

## D14 — Per-agent 0G Compute ledgers (real cost, real shape)

**Decision:** Each of the five agent operator wallets gets its OWN 0G Compute ledger funded with 3 OG (the broker's hard minimum) plus a 1-OG provider sub-account. Pre-flight bootstrap script `scripts/spike-18-bootstrap-inference.ts` handles this once. Every inference call in the multi-process spike runs under that agent's wallet — no shared inference identity.
**Alternatives considered:**
- Shared inference wallet (DEMO_PLANNER_KEY for all five). Faster to ship; the pitch weakness is small (TEE attestations are signed by the *provider*, not the consumer; consumer wallet only governs billing). But it muddies the on-chain story when judges read tx history.
- Hybrid (some agents share, others have their own). Awkward to explain.
**Why per-agent:**
- The pitch claim "five different operators" should hold across every axis the judges might inspect, including 0G Compute ledger entries on the contract.
- 5 ledgers × 3 OG floor = 15 OG. Initial estimate said this would burst the testnet OG budget, until three additional 5-OG donor wallets came in — making the option feasible.
- Each agent runtime instantiates `OGComputeInferenceProvider` with its own wallet → separate sub-accounts on chain → distinct billing trails.
**Cost:** ~30 minutes to write the bootstrap script + ~2 minutes to run (10 chain txs: 5 addLedger + 5 transferFund). 15 OG locked into ledgers (recoverable via deleteLedger if needed; treated as testnet sunk cost for the demo window).
**Made by:** Semih, Day 9 (2026-04-28), choosing the cleaner architecture once the OG budget arrived.

---

## D15 — `BID_WINDOW_MS = 120s` for the multi-process planner

**Decision:** The planner waits 120 seconds between broadcasting sub-tasks and triggering `awardAll`.
**Alternatives considered:**
- 8s default (originally set for in-process tests where bids are local function calls — orders of magnitude faster than chain).
- 75s (first pass — failed because each researcher places 3 sequential placeBids of ~30s each on the 0G testnet; sequential due to same-wallet nonce constraints).
**Why 120s:**
- 0G Galileo testnet placeBid latency: ~26–30 s per tx.
- Each researcher places one bid per sub-task across 3 sub-tasks = 3 sequential txs ≈ 90 s.
- 120s gives a 30s margin so even slightly slow-blocking RPC calls don't strand the swarm with task 2 unbid.
**Trade-off:** A shorter window would speed up the demo by ~30 s but risk reverts. Demo determinism > optimum runtime.
**Made by:** Semih, Day 9, after observing the first multi-process run lose task 1 + 2 bids when the 75s window fired before the second placeBid landed on chain.

---

## D11 — Backward-compat strategy for V2 Bounty refactor

**Decision:** Refactor Bounty.sol additively. Old `createBounty` path still works without messenger. New `createBountyWithSettlement` path wires the messenger. All 42 existing tests pass unchanged. Old V1 contracts archived in env, not deleted.
**Alternatives considered:**
- Hard cut: change `initialize` signature, force all tests to update.
- Use a proxy upgrade pattern (UUPS) so the same address evolves.
**Why additive:**
- The hackathon timeline punishes test churn. A signature change cascades through 7 test files; an additive change cascades through zero.
- Proxy pattern is overkill for a 12-day project and adds attack surface.
- Keeping V1 archived is honest about the development path — judges can see the V1 lifecycle (Spike 11) AND the V2 atomic-LZ (Spike 16) and verify the progression.
**Made by:** Semih, Day 7 (2026-04-28).

---

## D16 — Live VPS deployment with cron auto-bounty cadence (over single-machine demo only)

**Decision:** On Day 10, promote the swarm from "runs on the laptop when we run it" to "continuously running on the EU VPS — five `scholar-axl-*` + five `scholar-agent-*` systemd units (Restart=always), with a cron at `/etc/cron.d/scholar-swarm` firing `pnpm spike:18:cli` every six hours and auto-pushing `docs/vps-runs/latest.json` via a write-scoped GitHub deploy key". Frontend reads the artifact and renders a pulsing "VPS swarm live" badge.

**Alternatives considered:**
- Single-machine demo only — runs at video record time, dies otherwise.
- Same VPS but manual run only — no cron, judges see the live URL but no recent activity.

**Why live + cron:**
- "Continuously deployed" is the strongest possible signal that the swarm isn't a one-shot demo. By submission time the LiveBadge would have shown 4-5 successful auto-runs across multiple cron windows, each with on-chain proof.
- The artifact (`vps-runs/latest.json`) becomes a real-time judge-verifiable receipt — they can click the badge any time and see the most recent bounty hash.
- The auto-push is single-repo, single-file, write-scoped — operationally minimal, blast radius bounded. Post-submission cleanup TODO in memory.

**Trade-off:** Adds a write-scoped deploy key + 5 long-running systemd units to maintain. Justified by how much harder "live for 4 days" is to fake than "ran once during recording".

**Made by:** Semih, Day 10 (2026-04-30), after Spike 18 PASS landed and the question became "does the proof age out by submission time".

---

## D17 — Real Circle USDC end-to-end (Spike 19), not mock USDC

**Decision:** When the LZ-fires-LZ proof landed (Spike 16), the cross-chain message was provably arriving on Base Sepolia but no real ERC-20 was moving — the bounty escrow was holding 0 USDC at runtime. Day 10 question: ship a "mock USDC" path that just pretends, or do the real Circle USDC dance through KeeperHub's Direct Execution layer?

**Alternatives considered:**
- Deploy a `MockUSDC.sol` we control, mint to bounty, "distribute".
- Skip the payment layer entirely — pitch ends at "LZ message landed".
- Real Circle USDC + KH Direct Execution.

**Why real Circle USDC:**
- The whole pitch is "no trusted bot in the critical path". A mock USDC contract we own is a different kind of trusted bot — judges will see "you minted yourself the money you paid yourself".
- KH's Para wallet whitelisted on `PaymentRouter` is the actual production pattern. The keeper signs `distribute()`; we never hold its key. That's a meaningful architectural property.
- Spike 19 produces a single click-to-verify Basescan tx (`0xa06717e4…`) showing 1.000000 USDC moving across 5 distinct operator wallets in 0.7 s. That's the cleanest one-line proof in the entire submission.

**Trade-off:** Cost ~1 USDC + ~0.001 ETH gas on Base Sepolia, ~3 hours of integration time (faucet, approve, fund, KH workflow trigger, verify deltas). Worth it for the unambiguous proof artifact.

**Made by:** Semih, Day 10 (2026-04-30), morning of polish day.

---

## D18 — Spike 20 (SearXNG over MCP-over-AXL) instead of accepting a fuzzy AXL pitch

**Decision:** On Day 10 evening, while reviewing draft sponsor-pitches.md text, caught that the AXL pitch was claiming "MCP-over-AXL pattern so one Researcher's locally-hosted SearXNG retrieval serves all agents through the mesh" — but the actual production code reached SearXNG through an SSH tunnel (Spike 15), not through MCP-over-AXL (Spike 3, mock router). Two separate proofs being implicitly conflated. Decided to spend ~1 hour writing Spike 20 instead of accepting the fuzzy phrasing.

**Alternatives considered:**
- Reword the pitch to honestly position MCP-over-AXL and SearXNG as separate proofs.
- Switch production retrieval to MCP-over-AXL (~3 hours, risks breaking the live cron).
- Write a small Spike 20 that proves SearXNG-over-AXL with a real router, document it as a standalone proof, and let production keep using SSH tunnel.

**Why Spike 20:**
- Pitch becomes literally true: "real Google/Bing/DuckDuckGo results returned to a peer through the Yggdrasil mesh in 2.3 s". No qualifications, no "in principle".
- 1-hour cost vs the 3-hour cost of switching production. Doesn't risk the live VPS cron-driven bounty pipeline.
- The new `searxng-mcp-router.js` is a working reference for anyone wanting to plug a local tool into AXL — strengthens the SDK story too.

**Trade-off:** Spent the hour on Spike 20 instead of starting the demo video recording 1 hour earlier.

**Made by:** Semih, Day 10 (2026-04-30) evening, after the user pushed back on the previous "two separate proofs" framing.

---

_Add new entries Day 11+ as decisions land. Format: D-number, decision, alternatives, why, made-by + date._
