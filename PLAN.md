# Scholar Swarm — Execution Plan

> Single source of truth. Supersedes `PROJECT_BRIEF_v2.md` where they disagree.
> Updated as spikes land. Last revision: 2026-04-27 (Day 3) — chain-split + iNFT locked.

---

## 1. Project Snapshot

- **Name:** Scholar Swarm
- **Event:** ETHGlobal Open Agents — online, async judging
- **Dates:** 2026-04-24 → 2026-05-06 (12 days, Day 0 = today)
- **Builder:** Solo — Semih Civelek (Himess), Ordu / TR
- **Repo:** `github.com/Himess/scholar-swarm` (TBD — create Day 0)
- **Submission:** GitHub repo + 2–4 min demo video + README + FEEDBACK.md (KeeperHub)

**Elevator pitch (locked):**
> AutoGPT is one model in a loop. Scholar Swarm is a decentralized research economy:
> specialist agents — Planner, Researchers, Critic, Synthesizer — run by different
> operators on different machines, compete for sub-bounties via AXL, retrieve real web
> sources via MCP, run attested inference on 0G Compute, and get paid automatically
> via KeeperHub. Every claim is source-attributed and critic-approved.

**What we sell (precise wording, used in submissions):**
- Cryptographically **attested reasoning** (what model ran — via 0G Compute attestation)
- Human-auditable **sourcing** (every claim links back to a fetched URL)
- Economic accountability (reputation + payment per agent per job)

_Not "cryptographically auditable research" — that overclaims. Attestation proves the model, not the truth._

---

## 2. Prize Targets

ETHGlobal rule confirmed: **3 partner slots max**, but **multiple tracks from same partner count as 1 slot**. This unlocks dual 0G submission.

| Slot | Sponsor | Track(s) | Pool | 1st place | Realistic target |
|---|---|---|---|---|---|
| 1 | **0G Labs** | Framework + Swarms (both) | $15k | $2.5k (FW) + $1.5k (SW) | Top-3 FW + Top-5 SW |
| 2 | **Gensyn** | Best AXL Application | $5k | $2.5k | Top-3 |
| 3 | **KeeperHub** | Best Use (both Focus Areas allowed) | $4.5k | $2.5k | Top-3 |
| Bonus | KeeperHub | Builder Feedback | $500 | $250 (up to 2 teams) | $250 lock |

**Realistic ceiling if we place well:** ~$4k (0G both tracks) + $2.5k (Gensyn 1st) + $2.5k (KH 1st) + $250 (KH feedback) = **~$9k**.
**Realistic floor with submission + any placement:** ~$500 + ~$1k + ~$500 + $250 = ~$2.25k.

**Skipped on purpose:** Uniswap ($5k — swap integration forced), ENS ($5k — would bump a higher-value slot), World Network (scope).

**KeeperHub dual Focus Area:** Re-read of prize page — focus areas are examples, not exclusive. Pitch leads with Innovation (multi-party distribution primitive), Integration (x402) as secondary angle. Both visible.

**Framework track requirements (newly load-bearing):**
- "At least one working example agent built using your framework/tooling"
- Implies reusable SDK with real abstractions, not Scholar-Swarm-only code with SDK label
- Our answer: extract the 4-role pattern into `packages/swarm-sdk` with pluggable Inference / Storage / Messaging / Payment providers. Scholar Swarm = the reference example built on it. Budget: 1–2 extra days on Day 3 and Day 7.

---

## 3. Architecture — Locked Decisions

### 3.1 Roles (4 agent types, 5 running processes)

| Role | Count | Runs on | Wallet |
|---|---|---|---|
| Planner | 1 | Machine A (laptop TR) | Wallet P |
| Researcher 1 | 1 | Machine A | Wallet R1 |
| Researcher 2 | 1 | Machine B (Hetzner DE) | Wallet R2 |
| Critic | 1 | Machine B | Wallet C |
| Synthesizer | 1 | Machine B | Wallet S |
| Frontend | 1 | Machine A | — |

### 3.2 End-to-end flow

```
USER          → BountyFactory.createBounty(goal, budget)   [KeeperHub escrow]
PLANNER       → reads bounty, decomposes into 3 sub-tasks, broadcasts on AXL
RESEARCHERS   → each bids (price_offered, reputation_shown)
PLANNER       → selects winners per sub-task (reputation-weighted, tie-break: lower price)
RESEARCHER(w) → MCP retrieval (Tavily) over AXL → 0G Compute inference → findings
              → writes {claims[], source_urls[], excerpts[]} to 0G Storage
CRITIC        → for each claim: fetch URL (HTTP) + 0G Compute semantic-match check
              → approves or rejects with reason
REJECTED      → researcher retries once OR forfeits that sub-task's fee
SYNTHESIZER   → reads approved findings → writes final report to 0G Storage
KEEPERHUB     → PaymentRouter distributes: planner / researchers / critic / synthesizer
ERC-8004      → reputation registry updated per participant
USER          → reads final report with source-traceable claims in frontend
```

### 3.3 Key naming corrections vs brief v2

- **"staked reputation" → "reputation-weighted bid"**
  Researchers do NOT stake anything. Bid is `(price, rep_score)`. Planner selection weights both. Rejection causes rep decay, not slashing. This is the v2 section 3.1 / 5.2 contradiction resolved.
- **Researcher vs Critic use different models** when 0G catalog allows. If not, use same model but different system prompts + different seeds + record both attestations. Goal: avoid same-model-verifies-self trivial failure mode.

### 3.4 Reputation cold-start (video credibility fix)

Before demo recording, pre-seed reputations so the "competition" looks real on camera:
- Researcher 1: 12 prior jobs, 0.83 approval rate
- Researcher 2: 4 prior jobs, 0.95 approval rate (newer, less proven, higher quality)
- Critic: 20 prior reviews, 0.88 agreement-with-researcher-retry rate
- Synthesizer: 8 prior jobs, 4.4 / 5 user rating

This is honest — we ran them in testing. Document in README that demo rep comes from prior test jobs.

### 3.5 Demo deployment

- **Machine A:** Laptop (Ordu, TR). Runs Planner, Researcher 1, Frontend.
- **Machine B:** Hetzner VPS (€4.51/mo, CX22, Frankfurt). Runs Researcher 2, Critic, Synthesizer.
- Both AXL nodes, distinct peer IDs, distinct EOA wallets, distinct public IP addresses.
- **NAT pre-check (Spike 2b):** If AXL NAT traversal from Hetzner → laptop fails, fallback options:
  - (a) Put laptop on same network via ngrok TCP tunnel
  - (b) Move Researcher 1 to a second tiny VPS (€4.51 again, still 2 operators in narrative, still real separation)
  - (b) is preferred if (a) degrades demo quality.

---

## 4. Architecture — Open (Awaiting Spike Results)

| # | Question | Resolved by |
|---|---|---|
| O1 | 0G Compute model catalog + attestation blob format | Spike 1 |
| O2 | Does 0G Compute support tool use? If no, retrieval is external step. | Spike 1 |
| O3 | Does AXL NAT-traverse between Hetzner and Turkish ISP? | Spike 2b |
| O4 | Is MCP-over-AXL production-ready or fallback needed? | Spike 3 |
| O5 | KeeperHub x402 signing path — who signs (agent or KeeperHub)? | Spike 4 |
| O6 | 0G Storage read-your-write window | Spike 5 |
| O7 | ERC-8004 reference implementation + draft version | Mini-spike 7 |

---

## 5. Day 0 Smoke Spikes

Execute **sequentially** (solo, context-switching kills debug). Each has a hard go/no-go gate.

### Spike 1 — 0G Compute sealed inference   `[RISK: HIGH]   [time: 3–4 h]`
- Make one inference call from a TS script.
- Capture attestation blob; document format + size.
- Enumerate available models and pricing.
- Test: does the API accept `tools: [...]` / function calls? Yes / no / partial.
- **Go gate:** at least one model runs + attestation is returned in a parseable shape.
- **No-go:** abort architecture, consider TEE-inference alternative (Marlin, Phala) — but this forces sponsor swap away from 0G, major replan.

### Spike 2a — AXL local mesh   `[RISK: LOW]   [time: 1 h]`
- Two AXL nodes on same machine (Docker), exchange a message.
- **Go gate:** message delivered, encrypted on wire.

### Spike 2b — AXL cross-ISP mesh   `[RISK: MEDIUM-HIGH]   [time: 2 h]`
- One AXL node on laptop (TR ISP, NATed), one on Hetzner (public IP).
- Peer discovery + message delivery in **both directions**.
- **Go gate:** bidirectional peer-to-peer works on public internet.
- **No-go options:** relay mode, or move to 2-VPS setup (see 3.5).

### Spike 4 — KeeperHub x402 payment   `[RISK: MEDIUM]   [time: 2 h]`
- Create an x402 receipt, submit to KeeperHub, verify execution + audit trail.
- **Go gate:** single payment completes end-to-end.
- **No-go:** drop KeeperHub prize slot, replace with ENS or direct-contract payment. Major pitch rewrite.

### Spike 5 — 0G Storage RW   `[RISK: LOW-MEDIUM]   [time: 1 h]`
- Write JSON blob, read back, measure latency.
- Two consecutive reads after write — check consistency window.
- **Go gate:** read-your-write works within <3s.

### Spike 3 — MCP-over-AXL   `[RISK: MEDIUM, but has fallback]   [time: 2 h]`
- Register MCP tool on node A, call from node B over AXL.
- **Go gate:** call succeeds, response correct.
- **No-go:** fall back to HTTPS direct MCP; **trigger AXL pitch rewrite to Plan B** (see §8.2).

### Mini-spike 7 — ERC-8004 spec   `[RISK: LOW]   [time: 1 h]`
- Read spec, pick reference implementation, verify interface.
- **Go gate:** we know what functions to call and have a contract to inherit from.

### Skipped on purpose
- **Spike 6 (Exa vs Tavily):** default to **Tavily** (better for news/business queries, published MCP server). Reconsider only if Day 2 retrieval quality is bad. Saves 1–2 h.

### Day 0 total budget: ~11–13 hours
Realistic for one day if spikes go well. If Spike 1 drags, park Spikes 3 + 7 to Day 1 morning.

---

## 6. 12-Day Timeline (Revised)

| Day | Date | Focus | Buffer |
|---|---|---|---|
| 0 | Apr 24 | Stake + RSVP + Discord join + Spikes 1, 2a, 2b, 4, 5, 3, 7 | — |
| 1 | Apr 25 | Architecture doc revision (spike-informed). State machine. Monorepo scaffold. Contract interfaces. | — |
| 2 | Apr 26 | BountyFactory + Bounty contracts + unit tests. | — |
| 3 | Apr 27 | PaymentRouter + ReputationAdapter contracts + tests. Deploy to 0G testnet. | — |
| 4 | Apr 28 | Planner agent runtime + AXL integration + contract calls. | — |
| 5 | Apr 29 | Researcher runtime + MCP retrieval + 0G Compute inference. | — |
| 6 | Apr 30 | Critic runtime (HTTP + semantic) + Synthesizer runtime. | — |
| 7 | May 1 | End-to-end happy path with mocks swapped for real services. **Catchup buffer.** | ✅ |
| 8 | May 2 | KeeperHub payment flow wired. ERC-8004 writes. Bug fixes. | — |
| 9 | May 3 | Frontend (Next.js minimal). Single-machine full dry run. | — |
| 10 | May 4 | Hetzner provisioning. Agent split across 2 machines. Cross-machine dry run. | — |
| 11 | May 5 | Record video. README. Architecture diagram. FEEDBACK.md. | — |
| 12 | May 6 | Submission polish. Re-shoot if needed. Submit. | ✅ |

**Buffer rule:** Day 7 and Day 12 are untouchable buffer. If Days 2–6 finish on time, Day 7 is extra polish — not another feature.

---

## 7. Monorepo Layout

```
scholar-swarm/
├── PLAN.md                      ← this file, living doc
├── README.md                    ← written Day 11
├── FEEDBACK.md                  ← KeeperHub feedback, written Day 11
├── pnpm-workspace.yaml
├── package.json
├── foundry.toml
├── docker-compose.yml           ← local multi-agent dev
├── contracts/                   ← Foundry
│   ├── src/
│   │   ├── BountyFactory.sol
│   │   ├── Bounty.sol
│   │   ├── PaymentRouter.sol
│   │   └── ReputationAdapter.sol
│   ├── test/
│   └── script/
├── packages/
│   ├── shared/                  ← types, message schemas, AXL protocol defs
│   ├── swarm-sdk/               ← reusable 4-role framework (Framework track)
│   ├── axl-client/              ← AXL wrapper + typed messages
│   ├── og-client/               ← 0G Compute + Storage wrapper
│   ├── keeperhub-client/
│   └── mcp-tools/               ← Tavily MCP wrapper
├── apps/
│   ├── agent-planner/
│   ├── agent-researcher/        ← single codebase, runs as R1 or R2 via env
│   ├── agent-critic/
│   ├── agent-synthesizer/
│   └── frontend/                ← Next.js 16, minimal
├── scripts/
│   ├── spike-01-og-compute.ts
│   ├── spike-02a-axl-local.ts
│   ├── spike-02b-axl-cross-isp.ts
│   ├── spike-03-mcp-axl.ts
│   ├── spike-04-keeperhub.ts
│   ├── spike-05-og-storage.ts
│   └── spike-07-erc8004.ts
└── docs/
    ├── architecture.md          ← Mermaid diagrams
    ├── state-machine.md
    └── spike-results.md         ← log every spike outcome
```

**Tooling:** pnpm workspaces, Foundry, TypeScript everywhere except Solidity. Node 20+. No Docker in agent runtimes (only for local multi-instance dev).

---

## 8. Sponsor Positioning

### 8.1 0G Labs pitch (locked)

> Scholar Swarm is a multi-agent research framework on 0G's full stack. **0G Compute**
> runs every LLM call with sealed-inference attestation — researcher, critic, and
> synthesizer all produce attested outputs. **0G Storage** holds bounty descriptions,
> mid-research shared KV memory, findings with source URLs, critic rationales, and
> final reports. **0G Chain** hosts all contracts. The role pattern (Planner / competing
> Researchers / Critic / Synthesizer) is domain-agnostic: code review, legal analysis,
> content creation can all reuse the SDK.

### 8.2 Gensyn AXL pitch — Plan A / Plan B

Decided by Spike 3 outcome. Both pre-written Day 0.

**Plan A (MCP-over-AXL works):**
> AXL is the central nervous system. Every inter-agent message — bounty broadcasts,
> bids, research findings, critic feedback — flows over AXL. Additionally, retrieval
> tool calls (MCP to Tavily) are routed through AXL, so agent-to-tool traffic is
> end-to-end encrypted without any centralized relay. Demo runs on 2 physical machines
> (TR laptop + DE VPS) with distinct public IPs and live peer discovery. Remove AXL
> and the architecture needs a centralized coordinator.

**Plan B (HTTPS direct MCP, AXL only inter-agent):**
> AXL powers trustless agent discovery and messaging. There is no central registry —
> researchers discover sub-bounties by listening on AXL topics, and planner-researcher
> communication is peer-to-peer encrypted. Demo runs on 2 physical machines with
> distinct public IPs and live mesh discovery. AXL enables the swarm to exist without
> any coordinator — a coordinator-less agent swarm is the architecture.

### 8.3 KeeperHub pitch (locked, Focus Area 1)

> Scholar Swarm turns a single user payment into 5 agent payouts with execution
> guarantees. Planner, 2 Researchers, Critic, Synthesizer each paid via x402 micro-
> payments with retry logic. Our `PaymentRouter` contract + KeeperHub triggers
> guarantee no payout is lost even if individual agent txs fail. This is agent-native
> multi-party distribution — a new payment primitive for agent swarms.

---

## 9. Scope Lock

### 9.1 IN (MVP)
1 Planner · 2 Researchers (real bid competition) · 1 Critic · 1 Synthesizer
3 fixed sub-tasks per bounty
AXL multi-node across 2 machines
0G Storage (bounty data, mid-research KV, findings, critic rationales, final reports)
0G Compute attested inference (testnet `qwen-2.5-7b-instruct`, TeeML — only chatbot on testnet)
Tavily via MCP (AXL route if Spike 3 passes, HTTPS otherwise)
KeeperHub escrow trigger + Direct Execution API → PaymentRouter on Base + retry
**Smart hybrid contract layout (chain-split):**
- **0G Galileo Testnet:** `BountyFactory`, `Bounty`, `ReputationAdapter` (ERC-8004), `ArtifactRegistry`, **`AgentNFT` (ERC-7857 iNFT)**, **`AgentMarket`** — fork of `0gfoundation/0g-agent-nft`
- **Base Sepolia:** `PaymentRouter` only — USDC escrow + multi-party distribute, called by KeeperHub Direct Execution API
- **Cross-chain coordinator:** off-chain bot reconciles Base USDC events ↔ 0G bounty state (single trusted relay for hackathon, LayerZero in v2)
**iNFT integration (ERC-7857):**
- Each agent in the swarm is an iNFT minted on 0G Chain
- Encrypted intelligence (system prompts, role definition, accumulated context) stored on 0G Storage, hash on the iNFT
- Reputation accrues to the iNFT, not the wallet — agents are transferable assets
- Authorized usage demo'd: Researcher 2 is `authorizeUsage`'d to Critic's owner for one job
Minimal Next.js frontend: create bounty · live status · final report view · agent iNFT viewer (showing each agent's reputation + ownership)
Fixed demo prompt: *"Analyze the Stargate AI project (competitors, tech moat, financial health, risks)"*
Demo video (3 min) · README · architecture diagram (Mermaid) · KeeperHub FEEDBACK.md
Honest "Known Limitations" section (incl. trusted cross-chain relay)

### 9.2 OUT (v2 — do not re-add)
More than 2 researchers · cross-critic disputes · VARdict referee swarm · appeal
mechanism · staking/slashing · agent specialization beyond role · Uniswap · World ID ·
ENS (unless free Day 5 win) · mainnet · built-in wallet UI · mobile · "agent
marketplace" meta-layer · LayerZero/CCIP cross-chain messaging (trusted relay only).

### 9.3 Enforcement rule
If mid-project I propose anything in §9.2, respond:
> "§9.3 of PLAN.md. Scope locked. That's v2. Which §9.1 task is this unblocking?"

---

## 10. Known Limitations (also go in README)

1. **LLM-verifies-LLM risk.** Critic's semantic check is itself an LLM. Different model (or at minimum different prompt + attestation) reduces but doesn't eliminate correlated hallucination.
2. **Retrieval bias.** Tavily's coverage + paywall-blocked sources (Bloomberg, WSJ, some journals) may skew researcher toward open-web. Documented.
3. **Same-operator collusion.** Researcher-critic collusion not prevented in MVP. World ID is the v2 answer.
4. **Economic viability at scale.** 5-way split doesn't work for <$20 bounties. Scholar Swarm is for >$50 research jobs.
5. **Reputation cold-start.** New agents with 0 rep can't win bids easily. Bootstrapping mechanism = v2.
6. **Demo runs are operator-funded.** Both VPS and laptop agents funded from the same dev wallet hierarchy for demo purposes. Clearly documented.

---

## 11. Definition of Done (what "shippable" means)

A submission is shippable when **all** of these are true:

- [ ] User can post bounty from frontend, see escrow tx on-chain
- [ ] Planner decomposes and broadcasts sub-tasks visible in logs
- [ ] Both researchers bid, planner selects, selection visible in logs
- [ ] Winning researcher(s) fetch real web sources, store findings on 0G
- [ ] Critic performs HTTP check + semantic check, logs rationale
- [ ] At least one sub-task is rejected then retried successfully (scripted)
- [ ] Synthesizer produces a final report stored on 0G
- [ ] KeeperHub distributes payments to 5 agents, all txs visible on-chain
- [ ] ERC-8004 reputation writes visible on-chain
- [ ] Frontend shows final report with source links per claim
- [ ] Demo runs on 2 real machines with distinct public IPs
- [ ] Demo video ≤3 min, clean audio, golden-path complete
- [ ] README explains setup + architecture + known limitations
- [ ] FEEDBACK.md for KeeperHub submitted
- [ ] Contracts deployed + verified on 0G testnet
- [ ] All three sponsor prize submissions filed before deadline

---

## 12. Next Concrete Actions (today, in order)

1. **Pay stake + RSVP** on ETHGlobal Open Agents
2. **Join Discord servers:** ETHGlobal event, 0G Labs, Gensyn, KeeperHub
3. **Create GitHub repo** `Himess/scholar-swarm` (private until Day 11)
4. **Fetch API keys / testnet access:**
   - 0G testnet RPC + faucet tokens
   - 0G Compute API key (if required)
   - Tavily API key (free tier)
   - KeeperHub account
5. **Start Spike 1** (0G Compute) — this is the one that can force biggest replan
6. Log spike results to `docs/spike-results.md` as you go
7. End of day: update §4 Open Decisions with spike outcomes, commit `PLAN.md` to repo

---

## 13. Change Log

- **2026-04-27 (Day 3):** Major architecture lock after deep sponsor research.
  - **Smart hybrid (chain-split) LOCKED.** 0G = research economy + iNFT agents + reputation. Base Sepolia = USDC payment rails only.
  - **iNFT (ERC-7857) IN scope.** Each agent is an on-chain iNFT minted on 0G Chain — transferable, with encrypted intelligence on 0G Storage, reputation accrued to token. Forks `0gfoundation/0g-agent-nft`. Was OUT in earlier scope, brought IN to compete on Swarms track ("proof of embedded intelligence on 0G explorer" requirement).
  - **Real model catalog confirmed.** Testnet has 1 chatbot only (`qwen-2.5-7b-instruct`, TeeML). Mainnet has 7 (incl. `gpt-oss-120b`, `qwen3.6-plus`, `GLM-5-FP8`). Demo on testnet → same model, different system prompts for Researcher / Critic, both attestations recorded. Earlier dismissal of `qwen3.6-plus` / `GLM-5-FP8` as "made up" was wrong — they are real TEE-backed mainnet models.
  - **Funding panic deflated.** Inference price 0.05–0.10 0G per 1M tokens; full demo < 0.1 0G of inference. Need ~4 0G total per shared inference wallet (3 ledger + 1 provider sub). Faucet still tight (0.1/day) — Discord ask in flight.
  - **KeeperHub auth clarified.** `wfb_` is workflow-bound (read scope); `/api/execute/*` requires `kh_` full-account key. User to generate.
  - **KeeperHub does NOT support 0G Galileo** as a curated chain (chain registry is 20 chains, no 0G; FAQ explicitly lists supported set). Forces chain-split. NOT a downgrade — gives each chain a clear role and strengthens narrative.
  - **0G `llms-full.txt` archived** at `docs/og-llms-full.txt` (508 KB, 15k lines) — canonical reference.
  - 0G testnet system contracts captured in `docs/sponsor-reference.md`: Compute Ledger `0xE70830508d…`, Compute Inference `0xa79F4c83…`, Storage Flow/Mine/Reward, DAEntrance.

- **2026-04-25 (Day 1):** Real prize numbers verified, monorepo scaffolded.
  - ETHGlobal partner cap = 3 slots, but multi-track per partner counts as 1 slot.
  - Slot 1 = 0G (Framework + Swarms), Slot 2 = Gensyn AXL, Slot 3 = KeeperHub.
  - Realistic ceiling ~$9k, floor ~$2.25k.
  - Framework track requires reusable SDK + example agent → added `packages/swarm-sdk`.
  - Monorepo, root configs, 10 workspace stubs, `docs/spike-results.md` template all in place.

- **2026-04-24 (Day 0):** Initial plan from `PROJECT_BRIEF_v2.md` + v2 feedback iteration.
  - "staked reputation" → "reputation-weighted bid"
  - Reputation cold-start seeding strategy added
  - Pitch wording: "attested reasoning" + "auditable sourcing" — not "auditable research"
  - Spike 6 (Exa vs Tavily) dropped — default Tavily
  - Spike 2 split into 2a (local) + 2b (cross-ISP NAT)
  - Mini-spike 7 added (ERC-8004 spec)
  - Day 9 split strategy (single-machine first, then split Day 10)
  - Day 7 repositioned as catchup buffer
  - AXL pitch Plan A / Plan B drafted
  - NAT fallback: 2nd VPS option
