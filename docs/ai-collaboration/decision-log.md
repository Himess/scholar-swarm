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

_Add new entries Day 8+ as decisions land. Format: D-number, decision, alternatives, why, made-by + date._
