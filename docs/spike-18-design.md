# Spike 18 — Multi-process agent choreography over AXL

> **Status:** in design
> **Goal:** prove the swarm by running five independent OS processes, each owning one agent role, coordinating one bounty end-to-end via AXL messages and on-chain reads.

## Why this matters

[Spike 17](./spike-results.md) already ran the entire pipeline against live testnet, but in a single orchestrator process — so "five specialist iNFT agents that collaborate" was code-level, not process-level. The Gensyn AXL track explicitly requires *cross-AXL-node communication*; the 0G Agents/Swarms track explicitly seeks *specialist agent swarms* coordinating in real time. Spike 18 makes both literal.

Spike 17 stays in the repo as the single-process reference / fallback demo.

## Topology

Five Yggdrasil overlay nodes (AXL) on the laptop, peered into one mesh:

```
                 axl-node-planner  (TLS listen :9001, api :9101)
                       △
        ┌──────────────┼──────────────┐
        │              │              │
  axl-node-r1     axl-node-critic   axl-node-synth
  (:9102)         (:9104)           (:9105)

  axl-node-r2  (:9103) — also peers planner

(All non-planner nodes dial planner; Yggdrasil overlay forms the spanning
 tree, and broadcast iterates `tree[]` so every peer reaches every other.)
```

For the cross-ISP variant (Day 10), R2's AXL node moves to the EU VPS; everything else stays on laptop. Planner already publicly listens on the laptop's outbound TLS, but for the cross-ISP case R2 instead dials the VPS's existing public-IPv4 listener (Spike 2b box, port 9001). The mesh stays one Yggdrasil network.

## Process layout

| Process | AXL endpoint | Operator wallet | On-chain ops |
|---|---|---|---|
| `agent-planner` | `127.0.0.1:9101` | `PLANNER_OPERATOR_KEY` | acceptPlanner, broadcastSubTasks, awardBid |
| `agent-researcher` (instance #1) | `127.0.0.1:9102` | `RESEARCHER_1_OPERATOR_KEY` | placeBid, submitFindings |
| `agent-researcher` (instance #2) | `127.0.0.1:9103` | `RESEARCHER_2_OPERATOR_KEY` | placeBid, submitFindings |
| `agent-critic` | `127.0.0.1:9104` | `CRITIC_OPERATOR_KEY` | reviewClaim |
| `agent-synthesizer` | `127.0.0.1:9105` | `SYNTHESIZER_OPERATOR_KEY` | submitSynthesis (atomically fires LZ V2) |
| `scripts/spike-18-cli.ts` | (user side) | `DEMO_PLANNER_KEY` | createBountyWithSettlement |

Each process is a long-running Node.js (no orchestrator bouncing them). They communicate exclusively through AXL `/send` + `/recv` and through on-chain reads of the `Bounty` contract.

## Choreography (one bounty end-to-end)

```
USER CLI
  └─▶ createBountyWithSettlement(...)            [on chain]
  └─▶ AXL broadcast { kind: "bounty.broadcast",
                       bounty: { id, address, goal } }
       │
       ▼
PLANNER receives bounty.broadcast
  ├─▶ acceptPlanner(plannerAgentId)              [on chain]
  ├─▶ 0G inference: decompose goal into 3 sub-questions
  ├─▶ broadcastSubTasks([q1, q2, q3])            [on chain]
  └─▶ AXL broadcast { kind: "subtask.broadcast",
                       bountyId, subTaskIndex, description }   × 3

RESEARCHER (R1, R2) receive subtask.broadcast
  ├─▶ placeBid(subTaskIndex, agentId, price, rep) [on chain]
  └─▶ AXL broadcast { kind: "bid", bid: {...} }

PLANNER collects bids per task (waits BID_WINDOW_MS ≈ 8s)
  ├─▶ awardBid(taskIndex, winningAgentId)        [on chain]
  └─▶ AXL broadcast { kind: "bid.awarded", ... }

AWARDED RESEARCHER receives bid.awarded matching it
  ├─▶ retrieval.search(subQuestion) (SearXNG)
  ├─▶ 0G inference: produce JSON claims
  ├─▶ 0G storage: putJSON(findings) → merkle root
  ├─▶ submitFindings(taskIndex, agentId, root)   [on chain]
  └─▶ AXL broadcast { kind: "findings", findings: {...} }

CRITIC receives findings
  ├─▶ retrieval.fetchUrl(claim.sourceUrls[0])    (HTTP re-fetch)
  ├─▶ 0G inference: semantic check excerpt-vs-claim
  ├─▶ 0G storage: store rationale
  ├─▶ reviewClaim(taskIndex, criticAgentId, approved, reasonURI) [on chain]
  └─▶ AXL broadcast { kind: "review", review: {...} }

SYNTHESIZER caches each finding + each approved review.
  When approved-count == SUB_TASK_COUNT (3):
  ├─▶ 0G inference: compose final report from findings
  ├─▶ 0G storage: putJSON(report) → merkle root
  ├─▶ Bounty.previewPayouts() to compute LZ fee
  ├─▶ Quote LZ via Messenger.quote()
  ├─▶ submitSynthesis(synthAgentId, reportRoot)
  │      { value: lzFee }                         [on chain]
  │   ↳ Bounty atomically fires BountyMessenger.notifyCompletion
  │   ↳ LayerZero V2 message dispatched to Base Sepolia
  │   ↳ KH workflow nepsavmovlyko0luy3rpi catches DistributeRequested
  │   ↳ PaymentRouter.distribute() pays USDC to all 5 agent wallets
  └─▶ AXL broadcast { kind: "report.delivered", report: {...} }

USER CLI watches Bounty.status() on chain until == Completed.
  ├─▶ Read finalReportRoot from contract
  ├─▶ Fetch report JSON from 0G Storage
  └─▶ Print report.body.
```

## Implementation slices

Order matters — each slice gates the next.

### Slice 1: AXL infra
- Generate 5 ed25519 identities (`infra/axl-node-{role}/private.pem`).
- Write 5 `node-config.json` (planner = listener, others dial planner).
- Wrap in `scripts/spike-18-axl-launch.ts` that spawns all five AXL nodes + waits for spanning tree to converge.
- All under `infra/` are gitignored (private keys + IP).

### Slice 2: ChainAdapter
- Add `ChainAdapter` interface to `@scholar-swarm/sdk/providers.ts` with the methods listed above.
- Implement `EVMChainAdapter` in `@scholar-swarm/og-client` (or new package). Wraps an ethers `Wallet` + `Contract` instance for `Bounty` + `BountyFactory` + `BountyMessenger`.
- Inject via `RoleContext.providers.chain`.

### Slice 3: Role updates
- `PlannerRole`: handle `bounty.broadcast` → call chain.acceptPlanner + decompose + chain.broadcastSubTasks. Cache bids, after BID_WINDOW_MS call chain.awardBid.
- `ResearcherRole`: handle `subtask.broadcast` → chain.placeBid. handle `bid.awarded` (matching agentId) → research → chain.submitFindings.
- `CriticRole`: handle `findings` → verify → chain.reviewClaim.
- `SynthesizerRole`: cache findings + reviews. When all reviews approved, run synthesis + chain.submitSynthesis (with msg.value).

Existing role code already broadcasts the right SwarmMessages; we add chain calls inline.

### Slice 4: Runtime entrypoints
- Each `apps/agent-*/src/index.ts` wires the chain adapter from env (`OG_RPC_URL`, `OG_BOUNTY_FACTORY`, role's operator key).
- Add `RETRIEVAL_PROVIDER` resolver (mirrors spike-15/17 logic).
- Sub-process logger prefix per role.

### Slice 5: User CLI
- `scripts/spike-18-cli.ts`:
  - createBountyWithSettlement on factory v2.
  - Send `bounty.broadcast` to planner peer ID over AXL.
  - Poll `bounty.status()` every 5 s.
  - On Completed, read `finalReportRoot`, fetch from 0G Storage, print body.
  - Persist artifact `docs/spike-artifacts/spike-18.json`.

### Slice 6: Launcher
- `scripts/spike-18-launch.ts`: spawn 5 AXL nodes + 5 agent runtimes (in parallel, each its own log stream) + the user CLI.
- Or simpler for first run: each in its own terminal manually.

## Hard problems + mitigations

1. **Planner bid-window timing.** Planner needs to know all bids are in. Two options:
   - Fixed window (`BID_WINDOW_MS = 8_000`): simple, predictable. After window, award best bid per task; researchers that bid late lose.
   - Threshold (`#bids per task >= N`): faster but races with concurrent broadcasts.
   - **Choice:** fixed window. Demo determinism > theoretical optimum.

2. **Synthesizer trigger condition.** Synthesizer needs to know all 3 reviews are in. Options:
   - Count `review` messages with `approved === true`. Race-prone if a message is missed.
   - Read on-chain `Bounty.status()` until `Synthesizing`. Authoritative.
   - **Choice:** on-chain read. Synth role periodically polls the bounty's status; transitions to action when it sees `Synthesizing`. Robust to AXL message loss.

3. **Self-broadcast filter.** When an agent broadcasts, AXL's spanning-tree walker may include itself. The adapter filters `peerId === self.peerId` already.

4. **Agent ID ↔ AXL peer ID mapping.** AXL uses ed25519 (32-byte hex), agentId is a uint256 from AgentNFT. They're decoupled. The choreography routes by SwarmMessage content (e.g., `bid.awarded.agentId`), not by AXL peer ID. AXL peer ID only matters for `send()` (rare in our flow — most messages are `broadcast()`).

5. **Crash recovery.** If a process crashes mid-bounty, the bounty stalls. For demo: don't worry about it. Production: agents would tail on-chain events to catch up after restart.

## Acceptance criteria

Spike 18 PASS when:
- All 5 AXL nodes peer into one mesh (`/topology` from each shows the other 4).
- All 5 agent runtimes start and idle waiting for events.
- User CLI creates a bounty and broadcasts.
- Within ~3 minutes, the bounty reaches `Completed` status on chain.
- A `PayoutDispatched` event fires from the Bounty (LZ V2 message in flight to Base).
- The final report is readable from 0G Storage.
- Per-process logs visibly show the choreography (planner picks bids, researchers do research, critic reviews, synth fires LZ).

Cross-ISP variant (Day 10 stretch): same flow, but R2's AXL node lives on the EU VPS. The synth tx receipt + LZ GUID still appears.
