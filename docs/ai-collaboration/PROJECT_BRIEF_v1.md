# Scholar Swarm — ETHGlobal Hackathon Project Brief

> **Context for Claude Code:** This document is the complete briefing for a hackathon project. I (the user) spent ~4 hours with Claude Web brainstorming, evaluating ~15 different ideas, and finally landed on this one. This file captures **what we're building, why, how, and what we consciously decided NOT to build**. Please read it fully before suggesting changes. Then tell me honestly: does this project make sense? Any red flags? What would you push back on?

---

## 1. Quick Summary

**Project name:** Scholar Swarm

**One-liner:** "AutoGPT but decentralized, verifiable, and with an economy — a multi-agent research swarm where specialist agents compete, collaborate, and get paid on-chain."

**Hackathon:** ETHGlobal (online, async judging)

**Timeline:** 10 days

**Team:** Solo (me — Himess / Semih Civelek), possibly with Faruk (TBD)

**Submission format:** GitHub repo + 2-4 min demo video + README + FEEDBACK.md (for Uniswap if applicable)

---

## 2. The Problem We're Solving

### 2.1 Current state of AI research agents

Tools like AutoGPT, BabyAGI, LangChain agents, CrewAI, MetaGPT — all let you give a goal ("analyze Stargate AI") and get back a report. But they all share the same architectural flaws:

1. **Centralized trust:** A single LLM, a single operator, a single API key. If it hallucinates, you can't tell.
2. **No verification:** The "research" is unverifiable. No one checks sources. No critic step.
3. **No economy:** Agents are free workers. There's no market signal for quality. A good researcher and a bad researcher have equal standing.
4. **Single-user systems:** Each user runs their own AutoGPT locally. No shared reputation, no shared skills, no composability.

### 2.2 What enterprise users actually need

Hedge funds, VCs, consulting firms, investigative journalists, academic researchers — these people pay $500-$5000 per report for due diligence, competitive analysis, literature reviews. Why don't they use AutoGPT? Because:

- They can't verify the sources
- They can't audit the reasoning chain
- A single LLM's bias propagates through the entire output
- No accountability when things go wrong

**Our bet:** If we can make research agents **verifiable, multi-sourced, and economically accountable**, enterprise users will pay more per report than consumers and the system will produce higher-quality output than any centralized agent system.

---

## 3. The Solution — Architecture Overview

### 3.1 The roles

Scholar Swarm introduces a specialist agent role system where each role is a separate process, run by a separate operator, with its own reputation:

**Planner**
- Takes a user's research goal
- Decomposes it into subtasks (3 for MVP, expandable later)
- Creates sub-bounties on-chain
- Orchestrates the flow
- Earns an orchestration fee

**Researcher** (1 for MVP, expandable to N in v2)
- Picks up subtask bounties
- Performs the research using 0G Compute sealed inference
- Writes findings to 0G Storage (shared memory via KV)
- Submits result + source citations + reasoning hash

**Critic**
- Reviews researcher outputs
- Verifies source existence, claim-source alignment, logical consistency
- Approves or rejects (with reason)
- Rejected researcher must retry or forfeit payment
- Earns a verification fee

**Synthesizer**
- Waits for all approved researcher outputs
- Writes a coherent final report integrating all findings
- Stores final report on 0G Storage, hash on-chain
- Earns a synthesis fee

### 3.2 End-to-end flow

```
USER → Creates bounty (goal + payment locked in escrow via x402/KeeperHub)
  ↓
PLANNER (picks up bounty, commits orchestration stake)
  ↓ (decomposes goal, creates 3 sub-bounties)
  ↓
[Sub-bounty 1] → RESEARCHER A → 0G Compute → finding → 0G Storage
[Sub-bounty 2] → RESEARCHER B → 0G Compute → finding → 0G Storage
[Sub-bounty 3] → RESEARCHER C → 0G Compute → finding → 0G Storage
  (Note: for MVP, same researcher handles all 3 sequentially)
  ↓
CRITIC (reviews each finding)
  ↓ (approves 2/3, rejects 1 → researcher retries with better sources)
  ↓
SYNTHESIZER → reads all approved findings → writes final report
  ↓
KEEPERHUB → distributes payments to all participants
  ↓
ERC-8004 → reputation updates for all agents
  ↓
USER → receives report with traceable sourcing
```

### 3.3 Key principle: Different operators, different machines

For the demo to be meaningful, agents must run on **separate machines** with **separate operators**. This is what distinguishes from AutoGPT. We'll demo with 3-4 Docker containers on the same host (acceptable for hackathon), each running its own AXL node, each with its own wallet/identity.

---

## 4. Tech Stack & Sponsor Integration

### 4.1 0G Labs — deep integration (target: Framework track)

**0G Storage:**
- Bounty descriptions (user research goals)
- Shared memory for researchers (KV store — they can read each other's findings while working)
- Full research artifacts (citations, raw source excerpts, intermediate reasoning)
- Final synthesized report
- Critic judgments (full rationale)

**0G Compute:**
- Sealed inference for all agent LLM calls
- Critical: provides attestation that agent genuinely used claimed model
- Models: qwen3.6-plus or GLM-5-FP8 (0G supports these)

**0G Chain:**
- Deployment target for all smart contracts
- EVM-compatible so existing tooling works

**Framework track positioning:**
- Scholar Swarm is a **framework** for multi-agent research workflows
- Other developers can extend with new role types (Fact-checker, Translator, Summarizer, Legal-reviewer)
- Domain-agnostic — applies to code review, content creation, legal analysis, not just research
- Reference implementation + SDK for building specialized swarms

### 4.2 Gensyn AXL — core p2p layer (target: Best AXL integration)

AXL is the communication backbone. Zero centralized coordinator.

**What AXL carries:**
- Bounty broadcasts (new research jobs appear in the mesh)
- Agent bids (planners competing for bounties)
- Sub-bounty announcements (planner → researcher pool)
- Research findings (researcher → critic)
- Critic judgments (critic → researcher, possibly iterative)
- Final report delivery (synthesizer → user)

**Demo requirement:** Multi-node integration proven — the demo shows 3-4 AXL nodes running as separate processes with distinct peer IDs. AXL's "depth of integration" judging criterion is fully satisfied because removing AXL collapses the entire system.

### 4.3 KeeperHub — execution + payment (target: Best Use of KeeperHub)

**What KeeperHub handles:**
- Escrow creation when user posts bounty
- x402 nanopayments between agents (planner → researchers, planner → critic, planner → synthesizer)
- Payment distribution after completion (single user payment → multi-agent payout)
- Retry logic for failed transactions (research agents running out of gas shouldn't break the flow)
- Audit trail (every payment, every decision, fully logged)

**Why KeeperHub specifically:**
- A multi-agent payment flow is exactly the kind of complex execution that needs guaranteed completion
- x402 integration is natural — agents pay each other for services
- Fits Focus Area 2 (Best Integration — Payments)

### 4.4 Uniswap — optional feature, NOT a prize slot

**Role:**
- Cross-token settlement (user pays in USDC, agents may hold DAI, etc.)
- Nice-to-have but not architectural

**Prize decision:** We are **NOT applying for the Uniswap prize slot**. Reason: we only have 3 partner slots, and Uniswap integration is shallow (single swap call). Better to spend slots on sponsors where we have depth.

### 4.5 ENS — defer decision

Prize details still unclear. If it turns out to be a naming/identity prize, we'll register agents as `*.scholar.eth` with reputation metadata. Low effort to add late.

### 4.6 ERC-8004 — reputation integration (no prize, but architectural value)

After every job:
- Each agent's reputation gets updated based on outcome
- Researcher approval rate, critic accuracy, synthesizer quality
- Future bounties can filter agents by reputation score
- This makes Scholar Swarm a living user of the emerging agent reputation standard

---

## 5. Partner Prize Strategy

### 5.1 Our 3 chosen slots

**Slot 1: 0G Labs — Framework track ($7,500 pool)**
Positioning: "Scholar Swarm is a multi-agent research framework. The planner/researcher/critic/synthesizer pattern is reusable across domains."

**Slot 2: Gensyn AXL ($5,000 pool)**
Positioning: "Scholar Swarm is a decentralized research swarm where AXL provides ALL inter-agent communication. Remove AXL and the system collapses."

**Slot 3: KeeperHub ($4,500 pool)**
Positioning: "Scholar Swarm has complex multi-agent payment distribution. KeeperHub handles escrow, x402 micropayments, retry logic, and full audit trails."

**Total addressable prize pool: $17,000**

### 5.2 Bonus eligibility

- **KeeperHub Builder Feedback Bounty ($250):** We will write detailed UX/DX feedback as we integrate. Low effort, high reward ratio.
- **0G Swarms track ($1,500):** Scholar Swarm is also literally a swarm, so we may be eligible there too if Framework doesn't land.

### 5.3 Why NOT Finalist category

ETHGlobal lets you opt into Finalist judging (live 4-min demo + 3-min Q&A). We are NOT opting in. Reasons:
- Scope of work is tight; no spare time for live demo prep
- Partner prizes cover majority of prize money anyway
- Solo/small team; live Q&A is resource-intensive

---

## 6. Scope Discipline (VERY IMPORTANT)

This is a 10-day project with tight scope. **We already agreed on what we will NOT build.** If during development the temptation arises to add any of these, the answer is always "v2":

### 6.1 Things we ARE building (MVP)

- ✅ 1 Planner agent
- ✅ 1 Researcher agent (handles all subtasks sequentially)
- ✅ 1 Critic agent
- ✅ 1 Synthesizer agent
- ✅ 3 subtasks per bounty (fixed for MVP)
- ✅ AXL multi-node communication (3-4 nodes running as separate processes)
- ✅ 0G Storage for shared memory
- ✅ 0G Compute for sealed inference
- ✅ KeeperHub for escrow + x402 payments + distribution
- ✅ Smart contracts: BountyFactory, Bounty, PaymentRouter, ReputationAdapter
- ✅ Minimal frontend for demo (just bounty creation + status view)
- ✅ Demo video showing real end-to-end flow
- ✅ README, architecture diagram, setup instructions
- ✅ FEEDBACK files for KeeperHub (and Uniswap if slot used)
- ✅ ERC-8004 reputation write after job completion

### 6.2 Things we are NOT building (explicit v2 deferrals)

- ❌ Multiple parallel researchers (v2 — we simulate with one)
- ❌ Multiple critics or cross-critic disputes (v2)
- ❌ Dispute resolution mechanism / VARdict-style hakem swarm (explicitly chose NOT to include this earlier in brainstorming)
- ❌ Appeal mechanism
- ❌ Staking/slashing for researchers/critics (simpler payment on approval only)
- ❌ Agent specialization beyond role (no "financial analyst" vs "tech analyst" in MVP — one researcher handles everything)
- ❌ iNFT (ERC-7857) integration (v2, optional for 0G bonus but complex)
- ❌ Full web UI with account management (only minimal demo UI)
- ❌ Uniswap cross-token settlement (feature may appear in code, but no prize slot)
- ❌ Mobile app
- ❌ Browser extension
- ❌ Mainnet deployment (testnet only — 0G testnet + relevant Sepolia contracts)

### 6.3 The scope discipline rule

**During development, if I suggest adding something new to "make it more impressive," push back hard.** Remind me that 10 days is actually ~5-6 coding days (setup, debugging, video, README, FEEDBACK all eat time). A working MVP beats an ambitious half-built project.

---

## 7. 10-Day Timeline

The hackathon gives us ~10 days. Realistic plan:

**Day 1-2: Setup & Architecture**
- Spin up 0G testnet account, get RPC, get testnet tokens
- Install AXL locally, run 2-3 nodes, verify mesh connectivity
- Set up KeeperHub account, understand x402 flow
- Write contract interfaces (BountyFactory, Bounty, PaymentRouter)
- Write state machine doc (which state transitions to what)
- Resolve open questions (see section 9)

**Day 3-4: Core contracts**
- Implement BountyFactory.sol
- Implement Bounty.sol (escrow, lifecycle, approval states)
- Implement PaymentRouter.sol (payment distribution to agents)
- Unit tests for each
- Deploy to 0G testnet

**Day 5-6: Agent runtimes**
- Planner agent runtime (TypeScript, uses 0G Compute + AXL + contracts)
- Researcher agent runtime (TypeScript, uses 0G Compute + Storage)
- Critic agent runtime
- Synthesizer agent runtime
- End-to-end integration test with mocked LLMs first

**Day 7: Real LLM integration**
- Replace mocks with 0G Compute sealed inference
- Test with qwen3.6-plus or GLM-5-FP8
- Verify attestation flow works
- Adjust prompts for reasonable quality output

**Day 8: KeeperHub + frontend**
- KeeperHub x402 payment flow integration
- Retry logic, audit trail
- Minimal Next.js frontend (bounty creation form, status viewer, final report display)
- ERC-8004 reputation update calls

**Day 9: Polish + video**
- End-to-end dry run with real demo scenario ("Analyze Stargate AI")
- Fix any bugs
- Record demo video (2-3 takes)
- Write README, architecture diagram (Mermaid)
- Write FEEDBACK.md files (KeeperHub, etc.)

**Day 10: Submission buffer**
- Re-record video if needed
- Final submission
- Post-submission relaxation

---

## 8. Demo Scenario (for Video)

**Prompt used:** "Analyze the Stargate AI project. Cover: competitors, technology moat, financial health, key risks."

**What the demo will show:**

1. User posts bounty (on-chain transaction visible)
2. 3-4 terminal windows side by side, each showing an AXL node running
3. Planner node picks up the bounty, prints its decomposition
4. Planner publishes 3 sub-bounties to AXL mesh
5. Researcher node picks them up one by one, each time calling 0G Compute (visible in logs)
6. Researcher writes findings to 0G Storage (visible)
7. Critic node reads findings, logs its review, approves 2/3, rejects 1 with reason
8. Researcher retries rejected one with additional sources
9. Critic approves
10. Synthesizer reads all approved findings, produces final report
11. Report stored on 0G, hash visible on-chain
12. KeeperHub executes payment distribution (visible on-chain)
13. ERC-8004 reputation updates logged
14. Frontend displays final report with source attribution per claim

Script tone: fast, technical, confident. Use the "AutoGPT but decentralized" frame in first 20 seconds.

---

## 9. Open Technical Questions (for Claude Code to help answer)

These need to be resolved before or during Day 1-2:

1. **0G Compute sealed inference API:** What exactly does the attestation look like? Can we verify it on-chain cheaply, or is it verified by a trusted relayer?

2. **AXL node identity:** Does each node have a stable peer ID? How do we map peer IDs to on-chain wallet addresses for payment purposes?

3. **x402 flow with KeeperHub:** Can KeeperHub trigger x402 payments on our behalf, or does the agent itself sign x402 receipts? What's the integration path?

4. **0G Storage KV consistency:** If researcher A writes at T1 and researcher B reads at T1+epsilon, is read-your-write consistency guaranteed? What are the staleness windows?

5. **Cost estimation:** What's a rough cost per research job on 0G testnet? If mainnet deploy eventually, is the economic model viable?

6. **Research prompt engineering:** How do we make a researcher agent actually useful vs generic? Does it need web search tools (MCP?), or does 0G Compute's LLM have access to retrieval?

7. **Critic prompt:** How does the critic verify a source actually exists without internet access? This is the hardest prompt design problem.

8. **Sync vs async:** Do agents poll for new bounties, or does AXL push events? What's the best pattern?

---

## 10. What Makes This Win vs Other Hackathon Projects

Based on analysis of past ETHGlobal winners and the "Veil VPN" example (winner of ETHGlobal Cannes):

### Formula for a winning hackathon project:

1. **Known big problem** — AutoGPT-style agents are broken for serious use. ✅
2. **Multiple sponsors architecturally required** — 0G, AXL, KeeperHub each irreplaceable. ✅
3. **Clear business model** — paid research reports, micropayments among agents, reputation-weighted market. ✅
4. **Visually demonstrable** — 4 terminals doing their thing, bounty flow on-chain. ✅
5. **Combines known tech in new way** — LLMs exist, agents exist, p2p exists, escrow exists. We combine them into a verifiable research economy. ✅
6. **10-day feasible** — yes with discipline. ✅

### The pitch sentence:

> "AutoGPT has no economy, no verification, no multi-party trust. Scholar Swarm is a decentralized research swarm where specialist agents — planner, researcher, critic, synthesizer — each run by different operators on different machines, coordinate via AXL, compute via 0G, and get paid automatically via KeeperHub. One single user payment flows through the swarm and produces a verifiable, sourced, critic-approved research report."

---

## 11. Honest Risks & Mitigations

**Risk 1: Scope creep mid-project.**
Mitigation: This document is the law. Anything not in section 6.1 is v2. Push back hard on new ideas.

**Risk 2: 0G Compute may be more complex than expected.**
Mitigation: Day 1 spike — just get a single inference call working. If it takes more than 4 hours, simplify.

**Risk 3: AXL may require system-level networking I don't have experience with.**
Mitigation: Use Docker for nodes in demo. Local mesh is fine for hackathon. Production deployment is not a hackathon requirement.

**Risk 4: Agent outputs may be low quality, demo looks bad.**
Mitigation: Pre-pick a research topic I already understand. Pre-write good prompts. If LLM output is weak, curate and adjust prompts. The demo is about the system, not proving LLM capability.

**Risk 5: Video quality.**
Mitigation: Day 9 full dry run, day 10 as buffer. Write script first, record second. Keep under 3 min.

**Risk 6: Multiple people submitting similar "multi-agent research" projects.**
Mitigation: Our differentiator is **trustless + economy + verifiable**, not just "multi-agent." Lean into this in video narrative. Most competitors will do centralized multi-agent.

---

## 12. What I Need From Claude Code

Please help me with:

1. **First read this whole document and tell me honestly: does this project make sense? Any red flags? What would you push back on?**
2. Set up the project structure (Hardhat + TypeScript SDK + agent runtimes)
3. Draft the smart contracts (BountyFactory, Bounty, PaymentRouter, ReputationAdapter)
4. Help investigate the open questions in section 9 via docs reading
5. Build the agent runtimes iteratively
6. Help record a good demo at the end

When I suggest scope additions, **remind me of section 6.3 and push back.** I paid a small fortune in ChatGPT and Claude Web sessions to get to this scoped version. Don't let me undo it.

---

## Appendix A: Team Info (for submission)

- Primary builder: Himess (Semih Civelek)
- Possible collaborator: Faruk (Abdullah Faruk Özden)
- Contact: Telegram @[TBD], X @[TBD]
- Location: Ordu, Turkey
- Relevant background: 80+ merged PRs across Ethereum ecosystem, prior multi-sponsor hackathon wins (Zama Builder Track S1 winner with MARC), blockchain developer focused on Rust/TS/Solidity

## Appendix B: Why NOT the other ideas we considered

For transparency and to prevent re-opening these:

- **VARdict (Referee Swarm for ERC-8183 disputes):** Good idea but narrower sponsor appeal; also chose to avoid putting privacy/dispute complexity in this project.
- **AgentDeal (sealed-bid agent negotiation):** Too similar to existing SealTender (my Zama project). Risk of "same idea in different wrapper."
- **Encrypted Deliverable:** Shallow sponsor integration (2-3 sponsors), privacy not needed for this hackathon's sponsor set.
- **#5 Confidential Compute Marketplace:** Too ambitious for 10 days, demo harder to make compelling (TEE is invisible).
- **CityPulse reuse / Futbol hakem agent:** Pre-existing work (CityPulse) disqualifies per ETHGlobal rules; futbol-hakem too niche for sponsor pool.

---

## Appendix C: Prompt for Claude Code to Start

Paste this to Claude Code after placing this file on desktop:

```
We're building a project for ETHGlobal hackathon. I had a 4-hour brainstorming session with Claude Web and we landed on this. Full details in PROJECT_BRIEF.md on my desktop.

Please:
1. Read PROJECT_BRIEF.md in full
2. Tell me honestly: does this make sense? Any red flags? What would you push back on?
3. If it looks good, let's plan Day 1: project setup (Hardhat + TypeScript monorepo structure), and I'll share 0G / AXL / KeeperHub docs URLs when you ask for them

Important: the brief emphasizes scope discipline. If during this project I ever suggest adding features that aren't in section 6.1, please push back on my behalf. I specifically asked Claude Web to warn you about my tendency to scope-creep.
```
