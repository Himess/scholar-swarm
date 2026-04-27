# Scholar Swarm — ETHGlobal Open Agents Project Brief (v2)

> **Context for Claude Code:** This is the revised brief after your feedback on v1. I (Semih / Himess) took your pushback seriously and made the architectural revisions you asked for. Please read fully, then tell me honestly: are the revisions sufficient? Any remaining red flags? What to tackle first on Day 0?

---

## 0. What Changed From v1

You raised 5 red flags on v1. Here's how each is now addressed:

1. **Verification story was broken (no retrieval).** → FIXED. We're adding a web retrieval layer via MCP (Exa or Tavily), routed through AXL's built-in MCP channel. Researcher genuinely researches. Critic genuinely checks URLs (HTTP 200 + semantic match via LLM).

2. **"Different operators/machines" claim contradicted demo.** → FIXED. Demo now runs on 2 real machines: laptop (Turkey) + 1 Hetzner VPS (Frankfurt or similar). 4 agents split across them. Real IP, real internet, real AXL mesh discovery. ~€5 cost, ~2-3 hours setup on Day 10.

3. **"Economy/market" claim was fake in MVP.** → FIXED. Adding a 2nd researcher. They actually compete for sub-bounties — bid with (price + reputation), planner selects. This adds ~1 day scope but makes the pitch honest.

4. **4 third-party SDKs as Day 1-2 risk.** → FIXED. Day 0 now has 4 mandatory smoke spikes BEFORE architecture commits. If any spike fails, we adjust plan that day, not Day 7.

5. **Model name suspicions (qwen3.6-plus, GLM-5-FP8).** → FIXED. Day 0 spike #1 will verify actual 0G Compute model catalog and document real model names. Brief no longer hardcodes these.

---

## 1. Quick Summary

**Project name:** Scholar Swarm

**One-liner:** "AutoGPT is one model in a loop. Scholar Swarm is multiple specialist agents, each run by different operators with their own wallets and reputations, competing and collaborating on verifiable research — with real web sourcing, cryptographic attestation, and automatic payment distribution."

**Hackathon:** ETHGlobal Open Agents (online async)

**Dates:** April 24 – May 6, 2026 (12 days, not 10)

**Builder:** Solo — Semih Civelek (Himess), Turkey

**Submission format:** GitHub repo + 2-4 min demo video + README + FEEDBACK files for sponsors

---

## 2. The Problem

### 2.1 Current agent research tools are fundamentally broken

AutoGPT, BabyAGI, CrewAI, MetaGPT — all fail for serious use:

- **Centralized trust:** Single LLM, single operator, single API key. Silent failures invisible to user.
- **No verification:** Sources are unchecked. Even with web search, no second pair of eyes validates claims.
- **No economy:** Free worker model. No quality signal. No reputation. No accountability.
- **Not multi-user:** Each user runs their own instance. No shared agent market.

### 2.2 What enterprise users actually want

VCs, hedge funds, consulting firms, investigative journalists all pay $500-$5000 per research report. They don't use AutoGPT because:
- Can't audit sources
- Can't verify reasoning
- Single LLM bias propagates
- No accountability when wrong

### 2.3 Our bet

If we combine: **(a) multiple specialist agents, (b) verifiable inference, (c) real web retrieval, (d) critic verification, (e) economic accountability via on-chain payment + reputation** — we produce higher-quality research than any centralized agent + an open market any developer can extend.

---

## 3. Architecture

### 3.1 The 4 roles (MVP)

**Planner** (1 agent, 1 operator)
- Accepts user research bounty
- Decomposes goal into 3 sub-bounties
- Publishes sub-bounties to AXL mesh
- Selects winning researchers from competing bids
- Coordinates overall flow
- Earns orchestration fee

**Researchers** (2 agents, 2 operators — this is the competition)
- Listen to sub-bounty broadcasts on AXL
- Bid on sub-bounties they want (price + staked reputation)
- Planner picks winning bid per sub-bounty (can split: researcher A gets sub-task 1 and 3, researcher B gets sub-task 2)
- Winner performs retrieval via MCP (Exa/Tavily) routed through AXL
- Submits findings (claims + URL sources + excerpts) to 0G Storage
- Earns research fee on critic approval

**Critic** (1 agent, 1 operator)
- Reads each researcher's output
- For each claim:
  - Fetches source URL via HTTP (existence check)
  - Uses LLM (0G Compute) to check semantic match between claim and source content
- Approves or rejects (with reason)
- Rejected researcher re-works or forfeits payment
- Earns verification fee

**Synthesizer** (1 agent, 1 operator)
- Waits for all approved findings
- Writes coherent final report integrating all sources
- Stores report on 0G Storage
- Earns synthesis fee

### 3.2 End-to-end flow

```
USER → Creates bounty (goal + total budget, escrowed via KeeperHub)
  ↓
PLANNER picks up bounty
  ↓ (decomposes into 3 sub-tasks, broadcasts)
  ↓
RESEARCHER 1 and RESEARCHER 2 both bid on sub-tasks
  ↓ (Planner selects based on price + reputation)
  ↓
For each awarded sub-task:
  Researcher → Exa/Tavily via MCP over AXL → retrieves web content
  Researcher → 0G Compute sealed inference → drafts findings
  Researcher → 0G Storage → writes claims + source URLs + excerpts
  ↓
CRITIC reviews each finding
  ↓ (HTTP check + semantic LLM check)
  ↓ (2/3 approved, 1/3 rejected with reason)
  ↓
Rejected researcher redoes that sub-task (or forfeits)
  ↓
SYNTHESIZER reads all approved findings
  ↓ (produces final report to 0G Storage)
  ↓
KEEPERHUB distributes payments (planner + winning researchers + critic + synthesizer)
  ↓
ERC-8004 updates reputations per agent
  ↓
USER retrieves final report + source-traceable claims
```

### 3.3 Demo deployment: 2 real machines

**Not cosplay. Real separation:**

- **Machine A (laptop in Turkey):** Planner + Researcher 1 + Frontend
- **Machine B (Hetzner VPS in Frankfurt, €5/month):** Researcher 2 + Critic + Synthesizer
- Both run AXL nodes with different peer IDs
- Real internet (public IPs), real mesh discovery
- Demo video shows both terminals side by side, IP addresses visible

**Why this split:** 2-on-each-side forces at least one cross-machine communication per role type. Gensyn qualification requirement for "separate AXL nodes" satisfied authentically.

---

## 4. Sponsor Integration Depth

### 4.1 0G Labs — Framework or Agents track ($15k pool, apply to whichever fits better)

**Storage:**
- Bounty descriptions (research goals posted by users)
- Shared memory (KV store) for mid-research collaboration
- Final research artifacts (claims + URL sources + excerpts)
- Critic judgments (full rationale)
- Final synthesized report
- **Volume: ~5-10 MB per job**

**Compute:**
- Every LLM call by every agent (planner decomposition, researcher synthesis, critic semantic checks, synthesizer writing)
- Sealed inference attestation preserved on all calls
- Model TBD Day 0 (see spike 1)

**Chain:**
- Smart contracts deployed to 0G testnet
- EVM-compatible, standard Foundry tooling

**Framework positioning (preferred track):** Scholar Swarm is a framework for multi-agent verified workflows. Planner/Researcher/Critic/Synthesizer pattern applies to: research, code review, content creation, legal analysis, investigative journalism. We ship reusable role modules + SDK.

### 4.2 Gensyn AXL — deep, architecturally essential integration

**What AXL carries (not bolt-on, core):**
- Bounty broadcasts to researcher pool
- Researcher bids flowing to planner
- Planner selection announcements
- Research findings → critic channel
- Critic feedback → researcher channel (including retries)
- Final report → synthesizer → user
- **MCP tool calls (Exa/Tavily) routed through AXL** — this is the novel bit

**Why MCP-over-AXL matters:**
AXL ships with MCP support. Most projects will use AXL for agent-to-agent chat. We use AXL for both agent-to-agent AND agent-to-tool (retrieval APIs). This doubles AXL's role in the architecture. Without AXL, agents need centralized discovery, centralized MCP relay, or direct HTTP (losing encryption). Remove AXL and the system loses its trustless property.

**Demo proof:**
- 2 physical machines with distinct public IPs
- AXL nodes on each
- Live logs of peer discovery across public internet
- Mesh communication visible in packet captures if asked

### 4.3 KeeperHub — complex payment execution

**What KeeperHub handles:**
- User payment held in escrow on job creation
- x402 micropayments agent-to-agent (planner pays researchers, planner pays critic, etc.)
- Distribution logic: one user payment becomes 5-7 agent payments (planner 15%, 2 researchers 35% each, critic 10%, synthesizer 5%)
- Retry logic for failed txs (researcher running out of gas shouldn't break flow)
- Audit trail of every payment

**Innovation angle (Focus Area 1):** Multi-party automatic payment distribution for agent swarms. We ship a `PaymentRouter` contract + off-chain orchestration that turns single-payment → multi-payout execution reliable.

**Integration angle (Focus Area 2):** We integrate KeeperHub with x402 agent-to-agent payment rails.

Both qualify, one prize pool — aiming to score on both angles.

**Builder Feedback Bounty:** We will write detailed UX/bug/DX feedback as we build. $250 bonus low-effort.

### 4.4 Other sponsors

- **Uniswap:** NOT a partner prize slot (shallow fit). May appear in code for cross-token settlement but not slotted.
- **ENS:** Defer decision to Day 5 after checking prize details. If naming/identity prize, integrate `*.scholar.eth` as agent identities with reputation metadata. If not, skip.
- **World Network:** NOT a slot. Could add World ID to verify operators are distinct humans (sybil resistance) but explicit scope decision: out for MVP, v2 material.

### 4.5 Partner slot strategy (3 slots, cap per ETHGlobal rules)

1. **0G Labs** — Framework track (primary) or Agents track (fallback)
2. **Gensyn AXL** — Best AXL integration
3. **KeeperHub** — Best Use of KeeperHub (both Focus Areas applied)

Total addressable: ~$17k-$20k depending on placements

### 4.6 ERC-8004 reputation (no prize, architectural value)

- After every completed job, reputation registry updated for each participant
- Researcher: approval_rate (approved_claims / total_claims)
- Critic: accuracy (measured by researcher acceptance of critic feedback over time)
- Synthesizer: final_report_score (user rating + critic post-hoc)
- Planner: job_completion_rate
- Future bounties can filter by min_reputation — this is what makes the ecosystem quality-weighted

---

## 5. Scope Discipline

### 5.1 IN for MVP

- ✅ 1 Planner, 2 Researchers (competition), 1 Critic, 1 Synthesizer
- ✅ 3 sub-tasks per bounty (fixed)
- ✅ AXL multi-node (minimum 2 machines, 4 AXL nodes total)
- ✅ 0G Storage (bounty data, shared memory, findings, reports)
- ✅ 0G Compute sealed inference for all LLM calls
- ✅ Retrieval via Exa OR Tavily via MCP over AXL (pick one on Day 0)
- ✅ KeeperHub for escrow + x402 + payment distribution + retry
- ✅ Smart contracts: BountyFactory, Bounty, PaymentRouter, ReputationAdapter
- ✅ Minimal Next.js frontend: bounty creation form + live status + final report view
- ✅ ERC-8004 reputation write after completion
- ✅ Demo scenario hard-coded prompt: "Analyze Stargate AI project (competitors, tech, financial health, risks)"
- ✅ Demo video 2-4 min showing 2-machine architecture
- ✅ README, architecture diagram (Mermaid), FEEDBACK.md for KeeperHub
- ✅ "Known Limitations" section in README honestly documenting critic's semantic-match limits

### 5.2 OUT for MVP (explicit v2 — do not let me re-add)

- ❌ More than 2 researchers
- ❌ More than 1 critic (no cross-critic dispute)
- ❌ VARdict-style hakem swarm for disputes
- ❌ Appeal mechanism
- ❌ Staking/slashing (researchers' stake is just their reputation score, no slashing logic in MVP — just approval/rejection affecting future rep)
- ❌ Agent specialization beyond role (no "financial analyst" vs "tech analyst" — any researcher can take any sub-task)
- ❌ iNFT (ERC-7857) integration (0G bonus path, too complex for MVP)
- ❌ Uniswap cross-token settlement
- ❌ World ID operator verification
- ❌ ENS unless prize details land and integration is <1 day
- ❌ Mainnet deployment (testnet only)
- ❌ User accounts, wallets built into frontend (use wallet connect, MVP-minimal)
- ❌ Mobile
- ❌ "Agent skill marketplace" or anything beyond research use case

### 5.3 The discipline rule (please enforce)

If mid-project I suggest adding anything from 5.2 to "make the demo more impressive," respond with:

> "Section 5.3 of the brief. Scope locked. That's v2. Show me which v1 task is blocked on this feature, otherwise we move on."

I explicitly asked you to push back on my scope creep tendency. I burned 4 hours with Claude Web narrowing to this scope. Defend it.

---

## 6. Day 0 Smoke Spikes (BEFORE architecture commit)

These must pass before we write a line of production code. Each is ~1-2 hours.

### Spike 1: 0G Compute inference call
- Make one sealed inference call
- Capture and inspect attestation blob
- **Document the actual model catalog and names (NOT "qwen3.6-plus" unless confirmed)**
- Verify: does it support tool use / function calling? If NO, retrieval must happen outside 0G Compute and be fed in as context (this changes flow but not scope)

### Spike 2: AXL 2-node mesh
- Start AXL node A locally
- Start AXL node B on any other machine or Docker container
- Exchange a message peer-to-peer
- Confirm message is encrypted on wire

### Spike 3: AXL MCP channel
- Register a simple MCP tool on node A
- Call it from node B over AXL
- Verify correct response
- If this doesn't work as expected, fall back to direct MCP over HTTPS (degrades story but still works)

### Spike 4: KeeperHub x402 payment
- Create an x402 receipt
- Have KeeperHub execute it
- Verify audit trail

### Spike 5: 0G Storage read/write
- Write a JSON blob
- Read it back
- Measure latency
- Verify read-your-write consistency

### Spike 6: Retrieval API selection
- Try Exa free tier with 3 sample queries
- Try Tavily free tier with same 3 queries
- Compare result quality and API ergonomics
- Pick one

### Go/no-go gate

If ANY of spikes 1, 2, 4, 5 fail fundamentally (not just "has quirks" but "does not do what we need"), we replan that day — possibly switch sponsor, possibly simplify story. No Day-7 surprises.

Spike 3 is nice-to-have — if AXL MCP doesn't work out of box, fall back to HTTPS MCP direct.

---

## 7. 12-Day Timeline

**Day 0 (April 24 kickoff):** Stake, RSVP, Discord, read rules, run all spikes 1-6
**Day 1:** Architecture doc (revised based on spike findings). Contract interfaces. State machine diagram.
**Day 2:** BountyFactory + Bounty contracts. Tests.
**Day 3:** PaymentRouter + ReputationAdapter contracts. Tests. Deploy to 0G testnet.
**Day 4:** Planner agent runtime (TypeScript). AXL integration. Contract interaction.
**Day 5:** Researcher agent runtime (TypeScript). MCP retrieval integration. 0G Compute inference.
**Day 6:** Critic agent runtime. HTTP source check + LLM semantic match.
**Day 7:** Synthesizer agent runtime. End-to-end happy path with mocked parts.
**Day 8:** Replace mocks with real everything. KeeperHub payment flow. ERC-8004 write.
**Day 9:** Minimal Next.js frontend. Demo scenario dry run on single machine.
**Day 10:** Hetzner VPS setup. Split agents across machines. Real multi-machine dry run.
**Day 11:** Record demo video (2-3 takes). Write README, FEEDBACK.md, architecture diagram.
**Day 12 (May 6 deadline):** Polish, re-shoot video if needed, submit. Buffer.

---

## 8. Demo Video Script (3 min)

**0:00-0:20 Hook**
"AutoGPT runs one AI in a loop. When it hallucinates, you never know. Scholar Swarm is a decentralized research economy where specialist agents compete on sub-tasks, a critic verifies every claim against real web sources, and a synthesizer writes the final report. Each agent runs on a different machine, earns its own fee, and builds its own reputation."

**0:20-0:40 Problem setup**
Show user creating bounty: "Analyze Stargate AI: competitors, tech, financial health, key risks. 50 USDC. 2 hours."
Show on-chain escrow.

**0:40-1:30 Swarm in action**
Split screen: Turkish laptop terminals (Planner + Researcher 1) | Frankfurt VPS terminals (Researcher 2 + Critic + Synthesizer)
Show:
- Planner broadcasts 3 sub-bounties
- Both researchers bid on each
- Planner selects (researcher 1 wins 2 tasks, researcher 2 wins 1 task)
- Winners retrieve web content (Exa calls visible)
- Winners post findings to 0G Storage
- Critic pulls findings, checks URLs, rejects 1 with reason "source doesn't say that"
- Rejected researcher retries with better source
- Critic approves

**1:30-2:15 Synthesis and payout**
- Synthesizer produces final report
- KeeperHub triggers payment distribution (show txs)
- ERC-8004 reputation updates

**2:15-2:45 User sees result**
Frontend shows final report, each claim linked to source, traceable.

**2:45-3:00 Pitch close**
"Scholar Swarm: multi-agent research with cryptographic attestation, real source verification, and economic accountability. AutoGPT was a toy. This is the market."

---

## 9. Known Limitations (honest section, also goes in README)

We're honest about what this does NOT solve:

1. **Absolute ground-truth verification is impossible.** Our critic's semantic match is LLM-based, so hallucination is possible on verification too. What we offer: (a) source existence is verifiable (HTTP check), (b) two independent LLM calls (researcher + critic) reduce single-point hallucination, (c) every claim is source-attributed and auditable post-hoc by humans, (d) attestation proves the LLMs we claim were actually used.
2. **Retrieval quality depends on the retrieval API.** Exa/Tavily have their own biases and coverage limits.
3. **Collusion possible between researcher and critic** if both operated by same person. v2 adds World ID operator verification.
4. **Economic incentive works only at certain bounty sizes.** Very small bounties ($<20) don't cover 5-way fee split. Scholar Swarm is explicitly not aimed at micropayment use cases.
5. **Reputation cold start.** New agents have 0 reputation so hard to win bids. v2: bootstrapping mechanism.

---

## 10. Sponsor Prize Pitch Lines (for submission forms)

### 10.1 0G Labs pitch

"Scholar Swarm is a multi-agent research framework built on 0G's full stack. 0G Compute runs every agent's LLM calls with sealed inference attestation — which is what makes the research cryptographically auditable. 0G Storage holds bounty data, mid-research shared memory (KV), final findings with source URLs, and synthesized reports. 0G Chain hosts our contracts. The framework pattern (Planner + competing Researchers + Critic + Synthesizer) is domain-agnostic — other developers can build code review, content creation, or legal analysis swarms on the same SDK."

### 10.2 Gensyn AXL pitch

"Scholar Swarm uses AXL as the central nervous system. Every inter-agent message — bounty broadcasts, bids, research findings, critic feedback, retries — flows over AXL. Additionally, retrieval tool calls (MCP to Exa/Tavily) are routed through AXL, making agent-to-tool communication end-to-end encrypted without any centralized relay. Our demo proves multi-node: 2 physical machines (Turkey laptop + Frankfurt VPS), 4 AXL nodes, distinct public IPs, real internet mesh discovery. Remove AXL and Scholar Swarm needs a centralized coordinator, losing its trustless property."

### 10.3 KeeperHub pitch

"Scholar Swarm uses KeeperHub to transform a single user payment into 5-7 agent payouts reliably. Each job pays planner, 2 researchers, critic, synthesizer — each through x402 micropayments with retry logic. Our `PaymentRouter` contract works with KeeperHub's execution guarantees to ensure no payout is lost even if individual researcher txs fail. This is complex agent-native execution that would be impossible with naive tx submission. We write detailed UX feedback for the Builder Feedback Bounty."

---

## 11. Questions for Claude Code (Day 0)

1. Based on this revised brief, are v1's red flags fully addressed? Any new red flags introduced?
2. Spike priority order: which of the 6 Day 0 spikes is highest risk (most likely to fail and force replanning)?
3. Should I pick Exa or Tavily before Spike 6, or genuinely run both?
4. Project structure preference: monorepo (agents + contracts + frontend under one Foundry/pnpm workspace) or separate repos per component?
5. Any anti-patterns you saw in v1 that you're still skeptical about after v2 revisions?

After your answers, let's execute Day 0 spikes immediately.

---

## Appendix A: Builder Info

- Name: Semih Civelek (Himess)
- Location: Ordu, Turkey
- Role: Solo founder for this hackathon
- Background: 80+ merged PRs across Ethereum OSS (reth, revm, Optimism, Base, Miden), previous wins (Zama Builder Track S1 with MARC — FHE agent payments), Rust/TS/Solidity
- Contact: To be added to submission

## Appendix B: Ideas We Considered and Rejected (don't reopen)

- **VARdict (dispute referee swarm):** Good story, but narrower sponsor fit than research swarm; also privacy-complexity unnecessary for this hackathon's sponsor set.
- **AgentDeal (sealed-bid TEE auction):** Too close to SealTender (my Zama project); risk of "repackaging." Plus sponsor set for this hackathon doesn't favor TEE.
- **Encrypted Deliverable:** Shallow sponsor fit (2-3), privacy not required here.
- **Confidential Compute Marketplace:** Too ambitious for 12 days, TEE invisible in demo.
- **CityPulse / Futbol Hakem Agent:** Pre-existing work risk + niche sponsor fit.
- **Private Agent Negotiation (FHE):** SealTender near-duplicate.
- **Skill Marketplace / Agent Arena / Reputation Network:** All valid but less pitch-crisp than Scholar Swarm.
