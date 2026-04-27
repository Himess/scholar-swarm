# Claude Code feedback on PROJECT_BRIEF v1

**Recorded by:** Semih Civelek
**Date:** 2026-04-24 (Day -1)
**Source:** Claude Code CLI session, response to Semih's prompt:
> "ETH Global Hackathona katılıyoruz, bunun için Claude Web ile görüştüm fikir alışverişi yaptık ve bu projeyi yapmaya karar verdik. Masaüstünde PROJECT_BRIEF.md dosyası var, orada tüm detaylar yazıyor. Lütfen: 1. Dosyayı tam oku 2. Dürüst söyle: proje mantıklı mı? Kırmızı bayrak var mı? Neye push back edersin?"

This file is a faithful summary of the critical points Claude Code raised after reading [`PROJECT_BRIEF_v1.md`](./PROJECT_BRIEF_v1.md). Semih incorporated all five into [v2](./PROJECT_BRIEF_v2.md) before writing a single line of code. The structure of v2's "Section 0 — What Changed From v1" mirrors this list one-to-one.

---

## TL;DR — go/no-go

**Project core is sound.** Multi-agent research swarm is differentiated, the sponsor stack (0G + AXL + KH) maps cleanly to the architecture, and the "AutoGPT for serious research" pitch has a credible hook. **But there are five specific issues that, if shipped as-is, will hurt the demo and the verification story.** Address them before Day 0.

---

## Red flag #1 — Verification story is broken without retrieval

**The problem.** v1 says the Researcher "performs research" via 0G Compute sealed inference, then the Critic "verifies sources." But there is no actual source-fetching anywhere. The Researcher just calls an LLM, the LLM emits text, and the Critic reads that same text. Critic's "verification" reduces to a second LLM call — that's not verification, that's redundancy.

**Why this matters for the pitch.** "AutoGPT can hallucinate sources" only beats AutoGPT if our agents *don't* hallucinate. Without a retrieval layer, we hallucinate exactly the same way and our Critic catches nothing.

**What to add.**
- A `RetrievalProvider` interface in the SDK (search + fetchUrl).
- Researcher calls `retrieval.search(subQuestion)` to get real URLs + excerpts before inference.
- Critic calls `retrieval.fetchUrl(claim.sourceUrls[0])` to confirm the URL still resolves and the excerpt is on the page.
- Concrete impl: Tavily or Exa, wrapped behind the interface so it's swappable.

**Cost.** ~1 day of work + a free-tier API key. High-leverage relative to the demo impact.

---

## Red flag #2 — "Different operators / different machines" claim contradicts the demo

**The problem.** v1 talks about "specialist agents run by separate operators with their own reputation," but the demo plan runs all 4 agents on Semih's single laptop. A judge running the demo would see one wallet, one process tree, one IP address. The decentralization claim collapses.

**What to add.**
- Mint each iNFT to a *distinct* EOA — generated fresh on Day 5, not Semih's deployer wallet.
- Run the demo on **two physical machines**: laptop (Türkiye, NAT) + a Hetzner CX22 VPS (Frankfurt, public IP). Cross-ISP AXL mesh is the visible decentralization proof.
- Spike 2b (cross-ISP mesh) becomes a hard prerequisite for the demo. Provision the VPS on Day 7-8 to leave buffer.

**Cost.** ~€5 for the VPS, ~2-3 hours setup. Day 10 dry-run on two machines.

---

## Red flag #3 — "Economy/market" claim is fake with one Researcher

**The problem.** v1 ships 1 Researcher in MVP. With one Researcher there's no bidding, no competition, no "market signal for quality." The whole economic angle of the pitch is a future-tense promise.

**What to add.**
- 2 Researchers in MVP. They bid on each sub-task with (price, reputation snapshot). Planner picks the winning bid (lowest price tie-broken by reputation).
- One Researcher is allowed to win multiple sub-tasks per bounty — proves the auction is real, not theatre.
- This unlocks the "different operators" pitch from #2: 5 distinct iNFTs (Planner + 2 Researchers + Critic + Synthesizer) instead of 4.

**Cost.** +1 day scope. Worth it — without the auction, the economic story is hollow.

---

## Red flag #4 — Four third-party SDKs is a Day-1 risk

**The problem.** v1 commits to integrating 0G Compute, 0G Storage, AXL, KeeperHub, plus LayerZero or some bridge — without any spike validating that each one actually works the way the docs claim. If any of these is broken or has a hidden gotcha, you discover it on Day 7 with no time to recover.

**What to add.** Day 0 — before *any* architecture commits — runs 4-6 mandatory smoke spikes:
- Spike 1: 0G Compute round-trip (auth, list services, infer, attestation verify).
- Spike 2: AXL local mesh (2 nodes, peer discovery, send/recv).
- Spike 3: MCP-over-AXL (peer-hosted tool through router).
- Spike 4: KeeperHub Direct Execution (real Base Sepolia transfer tx).
- Spike 5: 0G Storage put/get round-trip.

**Each spike PASS or FAIL is a binary gate.** A FAIL forces a plan adjustment that day, not on Day 7.

---

## Red flag #5 — Model names look hallucinated

**The problem.** v1 mentions specific model identifiers (`qwen3.6-plus`, `GLM-5-FP8`) that don't show up in any 0G Compute documentation Claude Code could verify. If those models don't exist on the testnet, every code path that hard-codes them breaks.

**What to add.**
- Day 0 Spike 1 must enumerate the real `listService()` output and document the actual model identifiers in `docs/sponsor-reference.md`.
- Brief should not hardcode model names until Day 0 confirms them. (Spoiler: the actual model is `qwen2.5-7b-instruct` on TeeML.)

---

## Smaller things, not red flags but worth fixing

- **Sponsor slot math.** v1 lists 4 sponsors as "all in scope" but ETHGlobal caps at 3. Pick 3 deliberately on Day 0.
- **Verifier contract.** ERC-7857 needs a verifier; v1 doesn't say what to do for the hackathon. Stub for MVP, document the prod path.
- **Demo video budget.** 3-4 min is tight if you also want to show 5 agent processes coordinating. Plan the script Day 9, record Day 11.

---

## Bottom line

The project is interesting and well-positioned. The five red flags are fixable and the fixes make the pitch *more* credible, not less. Ship a v2 that addresses all five before any code commits.

**Suggested Day 0 sequence:**
1. Address #5 first (Spike 1 — confirm 0G models exist).
2. Address #4 (run 4-6 spikes as binary gates).
3. Revise the brief incorporating #1, #2, #3.
4. Lock scope.
5. Then start coding.
