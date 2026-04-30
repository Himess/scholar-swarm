# Day 0 Spike Results

> One row per spike. Log outcome, decisions, and any architecture impact.
> Update `PLAN.md` §4 (Open Decisions) as these close.

| # | Spike | Status | Outcome | Decision / Impact |
|---|---|---|---|---|
| 1 | 0G Compute inference | ✅ pass | Inference + attestation + tool-use ALL confirmed | Use indexed tuple access; SDK 0.7.5; TeeML via dstack; **tool use IS supported** |
| 2a | AXL local mesh | ✅ pass | A→B "hello scholar swarm" delivered + B→A reverse | Two `node.exe` instances, peers `bddf078f…` & `55f1e064…`, default tcp_port |
| 2b | AXL cross-ISP mesh | ✅ pass | TR laptop ↔ EU VPS bidirectional /send + /recv over Yggdrasil TLS, real internet | laptop pubkey `38b4976c…`, VPS pubkey `f2c4bc95…`, both keys in spanning tree |
| 3 | MCP over AXL | ✅ pass | `/mcp/{peer}/test-service` roundtrip with mock router | RouterResponse envelope `{response,error}` is the contract; **Plan A pitch confirmed** |
| 4 | KeeperHub x402 payment | ✅ pass | End-to-end transfer executed on Base Sepolia | TX `0x6ca23a64...` — KH Direct Execution full pipeline verified |
| 5 | 0G Storage read-write | ✅ pass | put(297B)=10.7s; get=2.3s; roundtrip equal | Root `0x42408920…` ; tx `0x3e1be7e1…fe5`; replicated to 3 nodes |
| 7 | ERC-8004 + ERC-7857 spec | ✅ pass | Spec read; inheritance plan in `spike-07-erc8004-erc7857.md` | `AgentNFT` unifies ERC-7857 + ERC-8004 IdentityRegistry; separate `ReputationRegistry`; ValidationRegistry skipped |
| 8 | KH MCP Streamable HTTP | ✅ pass | 26 tools live; list_workflows + list_action_schemas confirmed | KH canonical surface — depth of integration vs REST-only |
| 9 | LayerZero V2 cross-chain | ✅ pass | 0G → Base end-to-end, GUID `0x565ff853…`, ~40s latency | DVN-attested. Trusted relay disclaimer DELETED. |
| 10 | iNFT royalty split (live) | ✅ pass | 0.002 OG paid → 0.0019 owner / 0.0001 creator on-chain | tx `0xcef64b77…`, 95/5 split exact, isAuthorized true |
| 11 | Bounty lifecycle E2E | ✅ pass | 16 txs, 6 distinct operator signers, full state machine Open→Completed | bountyId 2 at `0x4a6FE339…F0f2` (0G) |
| 12 | Synth fires LZ → Base | ✅ pass | Synth signs `notifyCompletion` after synthesis, LZ delivers, Base emits DistributeRequested | GUID `0x1d96cc4c…`, base tx `0xa7f372d2…` |
| 13 | KH MCP `ai_generate_workflow` | ✅ pass | KH AI drafted 6 ops → 2-node workflow (DistributeRequested trigger + distribute action) | `{prompt}` is the parameter name (not `description`); ops parse line-by-line |
| 14 | KH `create_workflow` (live) | ✅ pass | Workflow created on org, returned id, verified via `list_workflows` | Workflow id `nepsavmovlyko0luy3rpi`; closes the cross-chain payout loop |
| 15 | Retrieval (SearXNG / Tavily) | ✅ pass | Self-hosted SearXNG on the EU VPS, 5 real Google results in 1.3s, top URL re-fetch HTTP 200 | Two `RetrievalProvider` impls, swappable via env; SearXNG default avoids vendor lock-in |
| 16 | Bounty.submitSynthesis fires LZ atomically (V2) | ✅ pass | V2 factory + payable submitSynthesis dispatches notifyCompletion in one tx — GUID `0x6cfdf46b…` | First architectural slice that closes the cross-chain loop without an off-chain coordinator |
| 17 | Full E2E (single-process orchestrator) | ✅ pass | Spike 17 PASS, 7 attested 0G inferences + 7 0G Storage refs + bounty + LZ V2, GUID `0x82fcb3f2…` (SearXNG) | One `pnpm spike:17` runs the entire pipeline; functions as the demo fallback |
| 18 | Multi-process choreography (5 processes, 5 AXL nodes, 5 ledgers) | ✅ pass | 5 OS processes coordinated bounty 20 end-to-end. Each agent signed its own chain tx + ran inference under its own 0G ledger. Synth fired LZ V2, GUID `0x0c6eb880…` | This is the "five different operators" pitch made literal |
| 19 | Real Circle USDC payout to 5 wallets | ✅ pass | KH Direct Execution signed `PaymentRouter.distribute(...)` with the Para wallet; 1.000000 USDC split exactly per the Bounty fee schedule across 5 distinct operator wallets in 0.7s | tx `0xa06717e4…` on Base Sepolia, KH-signed |
| 20 | SearXNG retrieval over MCP-over-AXL | ✅ pass | One AXL peer hosts a JSON-RPC router proxying SearXNG; another peer queries it via `POST /mcp/{peer}/searxng` and gets real Google/Bing/DuckDuckGo results back through the Yggdrasil mesh in 2.3s | Closes Spike 3's mock-router proof with a real production tool — `infra/axl-node-b/searxng-mcp-router.js` |

Statuses: ⏳ pending · 🟡 partial · ✅ pass · ❌ fail · 🔀 pivoted

---

## Spike 1 — 0G Compute

**Run:** 2026-04-27 11:12 UTC
**Script:** `scripts/spike-01-og-compute.ts`
**Wallet:** `0xF505e2E71df58D7244189072008f25f6b6aaE5ae` (0.1 OG balance)
**Artifact:** `docs/spike-artifacts/spike-01.json`

### Checklist
- [x] Able to authenticate / initialize SDK (`@0glabs/0g-serving-broker@0.7.5`)
- [x] Enumerate available models — **`qwen/qwen-2.5-7b-instruct`** (only chatbot on testnet)
- [x] One inference call returns text — confirmed 2026-04-27, 2685ms
- [x] Attestation blob captured + parsable — `Attestation valid: true`, signer `0x83df4B8E...D508cF`
- [x] Tool use / function calling supported — **YES**, model returned `calculator({"expression":"18 * 24"})`
- [x] Latency + cost recorded — 2685ms; sub-account auto-funded 2 OG (~ unsettledFee 0.000006 OG per call)

### Findings
- **Service tuple shape (SDK 0.7.5)** — `Result(11)` with indexed fields, NOT named properties:
  - `[0]` providerAddress, `[1]` serviceType, `[2]` url, `[3]` inputPrice (bigint),
    `[4]` outputPrice, `[5]` updatedAt, `[6]` model, `[7]` verifiability,
    `[8]` additionalInfo (JSON string), `[9]` delivererAddress, `[10]` enabled
- **Provider** `0xa48f01287233509FD694a22Bf840225062E67836` — single chatbot service operator
- **Endpoint** `https://compute-network-6.integratenetwork.work` (OpenAI-compatible)
- **Verification** `TeeML` — model runs inside dstack TEE
- **TEE Verifier** `dstack` (Phala Network's open-source framework) — `github.com/Dstack-TEE/dstack` v0.5.8
- **Provider hardware** Alibaba Cloud (`aliyun`)
- **Pricing** `5e10` input + `1e11` output per token = 0.05 / 0.10 OG per 1M tokens (matches docs)
- **Funding requirement** 3 OG ledger min + **2 OG** auto-fund per sub-account (docs said 1, SDK auto-funds 2) = **5 OG total** for first inference
- **Auto-funding** SDK 0.7.5 has built-in auto-fund-and-retry mechanism on `getRequestHeaders` — fails fast with `AccountNotExists` if main ledger missing

### Decisions (PLAN.md §4 closures)
- **O1 (model catalog) → CLOSED:** Use `qwen/qwen-2.5-7b-instruct` for both Researcher and Critic on testnet (different system prompts). Both attestations recorded. Same model is OK because TeeML signs each call independently with TEE-bound key.
- **O2 (tool use) → CLOSED YES:** 0G Compute provider supports OpenAI-compatible `tools` field. Verified by probing with a `calculator` tool — model returned a structured `tool_call`. **Implication:** Researcher can call retrieval, Critic can call source-fetch tool, both natively attested. Strengthens "agent-native" pitch.
- **Funding:** 5 OG arrived via Discord faucet 2026-04-27. Wallet `0xF505...E5ae` now at 5.1 OG.
- **TX trail (on Galileo):** `0x71bbe4e7…` (depositFund), `0xc3bbc9ca…` (initial sub-account), `0x777aed7e…`, `0x1fac5a5f…` (auto-fund top-ups).

---

## Spike 2a — AXL Local Mesh

**Run:** _TBD_

### Checklist
- [ ] Two AXL nodes started (Docker on same host)
- [ ] Peer discovery succeeds
- [ ] Message delivery confirmed both directions
- [ ] Wire capture shows encryption

### Findings
_TBD_

---

## Spike 2b — AXL Cross-ISP Mesh

**Run:** 2026-04-28
**Setup:** [`docs/axl-vps-setup.md`](./axl-vps-setup.md)
**Artifact:** `docs/spike-artifacts/spike-2b.json` (local only — provider details redacted from public artifact)

### Checklist
- [x] Laptop node running (TR residential ISP, behind NAT) — pubkey `38b4976c…`
- [x] EU VPS node running (Ubuntu 24.04, public IPv4) — pubkey `f2c4bc95…`, systemd `axl-node.service` enabled, ~2.4 MB RAM
- [x] Outbound connect from laptop logged: `Connected outbound: <vps-ipv6>@<vps-ip>:9001`
- [x] Both peers visible in `/topology` spanning tree (bidirectional discovery)
- [x] Laptop → VPS `/send` round-trip: HTTP 200, payload arrived intact at VPS `/recv`
- [x] VPS → laptop `/send` round-trip: HTTP 200, payload arrived intact at laptop `/recv`

### Findings

The mesh forms automatically the moment the laptop dials out — no NAT traversal hack needed because the residential side is the dialer (outbound TCP) and the VPS is the listener. Yggdrasil overlay handles routing, and the typed `/send` + `/recv` API on top of it is exactly the same code path that `scripts/spike-03-mcp-axl.ts` exercises locally — so the production stack is "the same code, with one more line in `Peers`."

This closes the "different operators on different ISPs" pitch: the demo can run with Planner + Critic + Synthesizer on the laptop and the two Researchers on the VPS, talking over real internet, with no central message broker.

---

## Spike 3 — MCP over AXL

**Run:** _TBD_

### Checklist
- [ ] MCP tool registered on node A
- [ ] Tool called from node B over AXL
- [ ] Correct response returned
- [ ] End-to-end encryption confirmed

### Findings
_TBD — outcome determines AXL pitch Plan A vs Plan B (§8.2)_

---

## Spike 4 — KeeperHub x402 Payment

**Run:** _TBD_

### Checklist
- [ ] Account provisioned
- [ ] x402 receipt created
- [ ] KeeperHub executes payment
- [ ] Audit trail inspectable
- [ ] Multi-party distribution primitive validated

### Findings
_TBD_

---

## Spike 5 — 0G Storage

**Run:** _TBD_

### Checklist
- [ ] Write JSON blob
- [ ] Read back same blob
- [ ] Immediate read-your-write consistency check
- [ ] Latency (write + read) recorded
- [ ] Cost per MB recorded

### Findings
_TBD_

---

## Spike 7 — ERC-8004 Spec

**Run:** _TBD_

### Checklist
- [ ] Spec draft version identified
- [ ] Reference implementation located
- [ ] Interface functions listed
- [ ] Decision: inherit vs custom implement

### Findings
_TBD_

---

## Spike 13 — KeeperHub `ai_generate_workflow`

**Run:** 2026-04-24
**Script:** `scripts/spike-13-kh-workflow-generate.ts`
**Artifact:** `docs/spike-artifacts/spike-13.json`

### What it does
Calls KH MCP tool `ai_generate_workflow` with a natural-language description of the
DistributeRequested → PaymentRouter.distribute pipeline. KH's AI returns a stream of
JSON operations (`setName`, `setDescription`, `addNode`, `addEdge`) that compose into
a runnable workflow definition.

### Outcome
- ✅ MCP connect + tool call OK
- ✅ Generated 6 operations: 1 setName, 1 setDescription, 2 addNode, 1 addEdge, 1 final
- ✅ Trigger node: `web3/query-events` watching `DistributeRequested` on `BASE_PAYMENT_MESSENGER`
- ✅ Action node: `web3/write-contract` calling `distribute(bytes32,address[],uint256[])` on `BASE_PAYMENT_ROUTER`

### Gotcha
The MCP tool parameter is `prompt`, not `description`. First call returned a 422 input-validation
error; fixed in `packages/keeperhub-client/src/mcp.ts::aiGenerateWorkflow`.

---

## Spike 14 — KeeperHub `create_workflow` (live on org)

**Run:** 2026-04-24
**Script:** `scripts/spike-14-kh-workflow-create.ts`
**Artifact:** `docs/spike-artifacts/spike-14.json`
**Workflow id:** `nepsavmovlyko0luy3rpi`
**Public link:** https://app.keeperhub.com/workflows/nepsavmovlyko0luy3rpi

### What it does
Reads the operations stream from spike-13, replays them into a `{ name, description, nodes, edges }`
workflow definition, then calls KH MCP `create_workflow` to persist it on the org. Verifies the
workflow lands by listing all workflows and matching by name.

### Outcome
- ✅ create_workflow returned `id=nepsavmovlyko0luy3rpi`, ownerId, organizationId
- ✅ list_workflows confirms the workflow is persisted on the org
- ✅ Workflow closes the cross-chain payout loop end-to-end:
  Synthesizer (0G) → BountyMessenger.notifyCompletion → LZ V2 → PaymentMessenger (Base)
  → DistributeRequested event → **KH workflow** → PaymentRouter.distribute → USDC payouts

### What this proves for the submission
KeeperHub is live execution on our actual contract, not a mock — anyone can open the workflow URL
and watch DistributeRequested events stream into the trigger node. KH retry + audit + gas estimation
sit on the action node; we don't have to run a centralized relayer.

---

## Spike 15 — Retrieval layer (SearXNG / Tavily)

**Run:** 2026-04-28
**Script:** `scripts/spike-15-retrieval.ts` (`pnpm spike:15`)
**Artifact:** `docs/spike-artifacts/spike-15.json` (local)
**Provider used in this run:** SearXNG (self-hosted on the EU VPS, reached via SSH tunnel `127.0.0.1:8888`)

### Outcome
- ✅ 5 real results returned in ~1.3s for query "What is LayerZero V2 DVN attestation and how does it differ from V1 oracle/relayer model?"
- ✅ Top result re-fetched at HTTP 200 (Critic verification path) — `https://medium.com/layerzero-official/layerzero-v2-deep-dive-869f93e09850`, 339 KB body
- ✅ Same `RetrievalProvider` interface implemented twice in `@scholar-swarm/mcp-tools` — `SearxRetrievalProvider` and `TavilyRetrievalProvider`. Switch by setting `RETRIEVAL_PROVIDER` env var; downstream code (Researcher, Critic) is unchanged.

### Why two backends
SearXNG is the default because it removes the third-party search-API dependency from the trustless multi-agent claim. SearXNG is open source (AGPL-3.0), federates Google / Bing / DuckDuckGo / Wikipedia under a unified JSON endpoint, and we run it on the same EU VPS that hosts the AXL listener (Spike 2b). Tavily remains supported as a hosted-API alternative for builds that prefer not to operate a search aggregator.

### What this proves for the submission
"Real source fetching" is real, with multi-engine federation and zero vendor lock-in. The Researcher's claims carry URLs that the Critic actually re-fetches; the search infrastructure is open-source code under our operational control.

---

## Spike 18 — Multi-process choreography (5 processes, 5 AXL nodes)

**Run:** 2026-04-28
**Setup:** [`docs/spike-18-design.md`](./spike-18-design.md)
**Bootstrap:** `scripts/spike-18-bootstrap-inference.ts` (one-shot per-agent ledger funding)
**Run:** `pnpm spike:18` in one terminal + `pnpm spike:18:cli` in another
**Artifact:** `docs/spike-artifacts/spike-18.json`

### What this is
Five independent OS processes (Planner, Researcher 1, Researcher 2, Critic, Synthesizer), each running its own AXL node on the laptop, each signing its own on-chain transactions with its own operator wallet, each calling 0G Compute under its own funded ledger. Coordinated end-to-end over Yggdrasil overlay messaging. The Bounty contract on 0G atomically fires a LayerZero V2 message to Base on synthesis.

### Topology

```
                axl-node-planner  (TLS :9201, api :9101)
                       △
        ┌──────────────┼──────────────┐
        │              │              │
  axl-node-r1     axl-node-critic   axl-node-synth
  (api :9102)     (api :9104)       (api :9105)

  axl-node-r2  (api :9103) — also peers planner

5 separate OS processes (one per agent) connect to their own AXL HTTP API.
Yggdrasil overlay routes between non-adjacent peers via the spanning tree;
broadcasts iterate a static peer-id list (env-injected) so messages reach
every agent regardless of tree-update propagation timing.
```

### Successful run — bounty 20

| Stage | When | Tx |
|---|---|---|
| createBountyWithSettlement | +0s | `0x84e341ae…` |
| acceptPlanner (user) | +1s | `0xfd6fe071…` |
| broadcastSubTasks (planner) | +75s | `0xb372d65f…` |
| placeBid × 6 (R1+R2 × 3 tasks) | +90-120s | 6 distinct txs from 2 wallets |
| awardBid × 3 (planner) | +220-235s | 3 distinct txs |
| submitFindings × 3 (R1, won all 3) | +236-275s | 3 distinct txs |
| reviewClaim × 3 (critic) | +295-385s | 3 distinct txs |
| **submitSynthesis (synth) → fires LZ** | **+411s** | **`0xa0e624d4…`** |
| Status `Completed` | +375s monitored | — |

**LayerZero V2 GUID:** `0x0c6eb88031ea51b3eaa6c6cbb10fab7fcc419eefc4262925ecd29e284985a6ad`
**Final report root (0G Storage):** `0xc013b49b178d0ce16959ae9716a5891532b655b8783ef19936825f50e8889a22`
**Total wall-clock:** ~6.5 minutes (one bounty, end-to-end, no orchestrator).

### What had to be solved

- **Per-agent 0G Compute ledgers (D14):** broker enforces a 3 OG minimum per ledger. With 5 agents that's 15 OG locked + 1 OG/agent for sub-account funding. Three additional 5-OG donor wallets covered it. Each runtime now bills inference under its own wallet — no shared inference identity.
- **`bountyAddress` propagation:** the user CLI sends `bounty.broadcast` directly to the planner peer. Researchers / critic / synth never see it, so they don't know the Bounty contract address. Fix: planner re-emits `subtask.broadcast` with `bountyAddress` attached, and the other roles cache it on receipt.
- **Static peer list for broadcast:** Yggdrasil's `/topology` returns a partial spanning tree from each leaf node — planner sees all 4 children, but children only see planner + maybe one sibling. AXLMessagingProvider now accepts a `staticPeers` config (env-injected list of all 5 agent pubkeys) and uses it for broadcast iteration, bypassing tree-convergence timing.
- **`BID_WINDOW_MS = 120 s`:** each researcher places 3 sequential placeBids of ~10-15 s each; window is sized so awards don't fire before the on-chain bids are visible.

### What this proves for the submission

The "five specialist iNFT agents" claim is now five OS processes, with five operator wallets each having a distinct on-chain identity, distinct chain transactions (16 txs from 5 different signers in this run), and distinct 0G Compute ledger entries. The choreography runs over real AXL inter-process messaging (not in-process). No single coordinator owns the cross-chain payout — the Bounty contract dispatches it itself.

---

## Spike 19 — Circle USDC payout via KeeperHub Direct Execution

**Run:** 2026-04-29
**Script:** `scripts/spike-19-real-usdc-payout.ts` (`pnpm spike:19`)
**Artifact:** `docs/spike-artifacts/spike-19.json`

### What this is
The cross-chain payout rail exercised with **Circle USDC** on Base Sepolia (`0x036CbD53…`, the canonical Circle-issued testnet USDC). User wallet funds a 1 USDC escrow into PaymentRouter, then the **KeeperHub Direct Execution REST API** is invoked — KH's Para wallet signs the `distribute()` call on our behalf, splitting the funds across the five Scholar Swarm operator wallets per the same fee schedule Bounty.sol uses.

This closes the last simulated step in the Day-9 architecture: every previous spike showed "USDC *would* be paid", Spike 19 shows USDC *actually* paid.

### What was on chain

Base Sepolia (chainId 84532). All explorer links live.

| Step | Tx | Link |
|---|---|---|
| `USDC.approve(router, 1 USDC)` | `0x0e539685a1ad8157a90111b0108f65e821afd1dddea859f99e318b41714ad120` | [basescan](https://sepolia.basescan.org/tx/0x0e539685a1ad8157a90111b0108f65e821afd1dddea859f99e318b41714ad120) |
| `PaymentRouter.fund(bountyKey, 1e6)` | `0x9d6d8c0beb6d34d1e15dcbc01e0831c4f74317b54beede156d2d44bd041c0699` | [basescan](https://sepolia.basescan.org/tx/0x9d6d8c0beb6d34d1e15dcbc01e0831c4f74317b54beede156d2d44bd041c0699) |
| **`PaymentRouter.distribute(...)` ← signed by KH Para wallet via Direct Execution API** | `0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7` | [basescan](https://sepolia.basescan.org/tx/0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7) |

### Distribution split (matches Bounty.sol fee schedule)

| Recipient | Wallet | USDC | Verified delta |
|---|---|---:|---:|
| Planner | `0xa2F013d2…` | 0.15 (15%) | +0.15 ✅ |
| Researcher 1 | `0xfD794089…` | 0.30 (30%) | +0.30 ✅ |
| Researcher 2 | `0x869fe9e3…` | 0.30 (30%) | +0.30 ✅ |
| Critic | `0x9A5f0650…` | 0.15 (15%) | +0.15 ✅ |
| Synthesizer | `0xe9A52F87…` | 0.10 (10%) | +0.10 ✅ |
| **Total** | | **1.00** | **+1.00 (exact)** |

PaymentRouter escrow row transitioned `Funded → Distributed` atomically inside the same `distribute()` tx; arrays validated by the contract's `sum(amounts) == totalAmount` check (revert otherwise).

### KeeperHub execution metrics

- **Endpoint:** `POST /api/execute/contract-call` then poll `GET /api/execute/{id}/status`
- **Execution id:** `tb7t62lqdkmcure7sktwl`
- **Trigger → on-chain confirmation:** **0.7 s**
- **Gas used:** 199,623 units, paid by KH Para wallet (`0x7109C8e3…`), not by us
- **Auth:** Bearer-token API key, no separate signing key on our side

### What this proves for the submission

1. **The economy settles end-to-end.** Circle USDC moves between operator wallets on Base Sepolia — Scholar Swarm picked Base for exactly this reason: it's where the canonical USDC contract lives.
2. **KeeperHub is in the critical path, not optional.** The keeper that signed the payout was KH's Para wallet — we never had its private key. KH provides retry, gas estimation, and audit trail on top.
3. **Cross-chain settle is end-to-end demonstrable.** With Spike 9 (LZ V2 0G→Base message), Spike 12 (Bounty atomically fires LZ on synthesis), Spike 18 (5-process choreography ending in an on-chain LZ tx), and Spike 19 (KH-signed USDC distribution), every link in the chain has on-chain proof.
