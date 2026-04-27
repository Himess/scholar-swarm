# Scholar Swarm

### AutoGPT for serious research.

> AutoGPT can hallucinate sources and you'd never know.
> **Scholar Swarm is five specialist iNFT agents** that fetch real sources, verify each other's claims, and run on TEE-attested inference.

Three mechanisms make the difference:

1. **Real source fetching.** Researchers retrieve web pages via Tavily MCP. No more "I read in some study…" — every claim carries a URL.
2. **Critic verification.** An independent agent fetches each cited URL and runs a separate attested LLM check: *does this excerpt actually support this claim?*
3. **TEE-attested inference.** Every LLM call runs on 0G Compute inside a dstack TEE. The signed attestation proves *which model produced what*, replayable by any third party.

Submitted to **ETHGlobal Open Agents 2026**. Solo build by [@Himess](https://github.com/Himess).
**Status (Day 4 / 2026-04-27):** 7 contracts live on testnet · 5 iNFT agents minted · 6/8 spikes pass with on-chain proofs · LayerZero V2 cross-chain layer in deploy.

---

## How it works (one bounty, end-to-end)

```
USER posts a research bounty                  →  funded in USDC on Base Sepolia
PLANNER (iNFT #1) decomposes into 3 sub-tasks →  attested by 0G Compute
RESEARCHERS (iNFT #2 + #3) bid on sub-tasks   →  reputation-weighted selection
        ↓
   each fetches real web sources via Tavily
   produces source-attributed claims
   stores findings on 0G Storage
        ↓
CRITIC (iNFT #4) reviews each claim:
   • HTTP-fetches every cited URL
   • runs separate attested LLM check on excerpt vs claim
   • approves or rejects with stored rationale
        ↓
SYNTHESIZER (iNFT #5) produces the final report
   • integrates only critic-approved findings
   • stored on 0G Storage, root committed on-chain
        ↓
PAYMENT distributes automatically
   • LayerZero V2 message lands on Base
   • KeeperHub triggers PaymentRouter.distribute()
   • USDC reaches all five agent wallets
```

The user gets a research report where every statement traces back to a fetched URL, every inference is cryptographically attested, and every contributor was paid for verified work.

---

## The five agents (live iNFTs on 0G Galileo)

Each agent is an **ERC-7857 iNFT** at `AgentNFT` ([`0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`](https://chainscan-galileo.0g.ai/address/0x68c0175e9d9C6d39fC2278165C3Db93d484a5361)). The role definition + system prompt for each is **AES-256-GCM encrypted** and stored on 0G Storage; the merkle root is committed in `iNFT.intelligenceRoot`.

| ID | Name | Role | Storage Root |
|---|---|---|---|
| 1 | Planner-Alpha | Planner | `0x5bf94ba24417…` |
| 2 | Researcher-One | Researcher | `0x6ff1668a8e0b…` |
| 3 | Researcher-Two | Researcher | `0xddcde3746fc2…` |
| 4 | Critic-Prime | Critic | `0x14b122824a89…` |
| 5 | Synthesizer-Final | Synthesizer | `0x5053fc01c8a7…` |

Mint artifact: [`docs/spike-artifacts/minted-agents.json`](./docs/spike-artifacts/minted-agents.json). Reputation seeds and full encrypted-intelligence roundtrip in [`scripts/mint-agents.ts`](./scripts/mint-agents.ts).

---

## Demo video

3-min demo lands Day 11 (May 4). Script outline: bounty creation → swarm coordination → critic catches a weak source → researcher retries → synthesis → payment lands → final report with per-claim source attribution. Re-running on demo day with two physical machines (laptop in Türkiye + Hetzner VPS in Frankfurt).

---

## What this repo contains

Two distinct deliverables:

1. **`@scholar-swarm/sdk`** — a swarm-first agent framework in the OpenClaw family. Code-first `Role` + `Provider` model, designed for **N agents coordinating one workflow**. Domain-agnostic, MIT licensed. Full details in [`packages/swarm-sdk/README.md`](./packages/swarm-sdk/README.md).

2. **Scholar Swarm itself** — the reference application built on the SDK. Five agent runtimes, six smart contracts, two LayerZero V2 OApps, integration adapters for 0G + AXL + KeeperHub.

The SDK is what other teams could fork to build their own swarms — code-review swarms, legal-analysis swarms, investigative-journalism swarms. Scholar Swarm is the example.

---

## Status — what's working today

| Capability | Status | Proof |
|---|---|---|
| 0G Compute attested inference | ✅ live | qwen2.5-7b TeeML / dstack — [Spike 1 PASS](#spike-results) |
| 0G Storage roundtrip | ✅ live | 297B blob, root `0x42408920…` — [Spike 5 PASS](#spike-results) |
| 5 agents minted as iNFTs | ✅ live | AgentNFT `0x68c0175e…` — [§ The five agents](#the-five-agents-live-infts-on-0g-galileo) |
| AXL P2P mesh between agents | ✅ live | 2-node Yggdrasil mesh, "hello" delivered — [Spike 2a PASS](#spike-results) |
| MCP-over-AXL agent-to-tool | ✅ live | `/mcp/{peer}/test-service` roundtrip — [Spike 3 PASS](#spike-results) |
| KeeperHub Direct Execution | ✅ live | Real Base Sepolia transfer tx [`0x6ca23a64…`](https://sepolia.basescan.org/tx/0x6ca23a6491cd17fea40d3e9a866d3028a98709bfc548bd0bf98966e2e51f921b) |
| KeeperHub MCP server (26 tools) | ✅ live | Streamable HTTP, real workflow listed — [Spike 8 PASS](#spike-results) |
| LayerZero V2 OApps | ✅ live | 0G→Base message delivered, GUID `0x565ff853…` ([Spike 9 PASS](#spike-results)) |
| iNFT royalty split (95/5 owner/creator) | ✅ live | 0.002 OG paid + on-chain split observed — [Spike 10 PASS](#spike-results) |
| Full Bounty lifecycle E2E (16 txs, 6 signers) | ✅ live | bountyId 2 at `0x4a6FE339…F0f2`, all state transitions on-chain — [Spike 11 PASS](#spike-results) |
| Synth → LZ → Base full pipeline | ✅ live | Synth signs after synthesis, Base emits `DistributeRequested` — [Spike 12 PASS](#spike-results) |
| Cross-machine demo (laptop ⇄ Hetzner) | ⏳ pending | Day 7-10 |

---

# Architecture

## Two chains, by design

Scholar Swarm runs on two chains because each one does a job the other can't.

- **0G Galileo Testnet (16602)** — purpose-built AI infrastructure. Attested inference (0G Compute), decentralized storage (0G Storage), per-agent on-chain identity (ERC-7857 iNFTs + ERC-8004 reputation). The economy lives here.
- **Base Sepolia (84532)** — mature payment rails. USDC at the canonical address, KeeperHub's native execution support, x402 micropayment infrastructure. Money settles here.

The two are stitched by a **trustless** cross-chain link (LayerZero V2), not a bot. See [§ Cross-chain payment via LayerZero V2](#cross-chain-payment-via-layerzero-v2).

```
┌──────────  0G Galileo  ──────────┐                ┌────────  Base Sepolia  ────────┐
│                                  │                │                                │
│  AgentNFT (5 iNFTs minted)       │                │  PaymentRouter (USDC escrow)   │
│  ReputationRegistry (ERC-8004)   │                │  PaymentMessenger (LZ V2)      │
│  ArtifactRegistry                │                │                                │
│  BountyFactory + Bounty (impl)   │  LZ V2 message │                                │
│  BountyMessenger (LZ V2)         │ ◀────────────▶ │     ▲                          │
│                                  │  DVN-attested  │     │                          │
│  0G Compute  →  TeeML/dstack     │                │     │ KeeperHub                │
│  0G Storage  →  KV + log + blob  │                │     │ Direct Execution API     │
│                                  │                │     │ (gas + retry + audit)    │
└──────────────────────────────────┘                └─────│──────────────────────────┘
                                                          │
                                              ┌───────────┴────────────┐
                                              │  AXL P2P mesh           │
                                              │  Planner ⇄ R1 ⇄ R2 ⇄    │
                                              │  Critic ⇄ Synthesizer   │
                                              │  + MCP-over-AXL tools   │
                                              └─────────────────────────┘
```

## Smart contracts on 0G

Six contracts on 0G Galileo, ~0.038 OG total deploy cost:

| Contract | Address | Purpose |
|---|---|---|
| `AgentNFT` | [`0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`](https://chainscan-galileo.0g.ai/address/0x68c0175e9d9C6d39fC2278165C3Db93d484a5361) | ERC-7857 + ERC-8004 IdentityRegistry unified |
| `ReputationRegistry` | [`0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13`](https://chainscan-galileo.0g.ai/address/0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13) | ERC-8004 standard |
| `ArtifactRegistry` | [`0xB83e014c837763C4c86f21C194d7Fb613edFbE2b`](https://chainscan-galileo.0g.ai/address/0xB83e014c837763C4c86f21C194d7Fb613edFbE2b) | 0G Storage hash anchors |
| `Bounty` (impl) | [`0x3905554071E2F121533EbB26Fcf7947C916299C1`](https://chainscan-galileo.0g.ai/address/0x3905554071E2F121533EbB26Fcf7947C916299C1) | Cloned per job |
| `BountyFactory` | [`0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE`](https://chainscan-galileo.0g.ai/address/0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE) | EIP-1167 clone factory |
| `StubVerifier` | [`0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5`](https://chainscan-galileo.0g.ai/address/0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5) | ERC-7857 verifier slot (TEE oracle is v2) |
| `AgentRoyaltyVault` | [`0x61cb7bfca6ad0cb050ab227cb22710a932582c61`](https://chainscan-galileo.0g.ai/address/0x61cb7bfca6ad0cb050ab227cb22710a932582c61) | Pay-to-authorize with 95/5 owner/creator split — ERC-2981 |

## Smart contracts on Base Sepolia

| Contract | Address | Purpose |
|---|---|---|
| `PaymentRouter` | [`0xda6ab98bb73e75b2581b72c98f0891529eee2156`](https://sepolia.basescan.org/address/0xda6ab98bb73e75b2581b72c98f0891529eee2156) | USDC escrow + multi-party distribute |
| USDC (canonical) | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) | Circle's Base Sepolia USDC |

## Cross-chain payment via LayerZero V2

Why LZ V2: KeeperHub doesn't support 0G — verified live on the API: *"Unsupported network: 0g"*. We needed real cross-chain message authority, not a trusted bot. LayerZero V2 endpoints on both chains are deployed and ACTIVE (verified via the LayerZero metadata API).

| Chain | EID | EndpointV2 | DVN (LayerZero Labs) |
|---|---|---|---|
| 0G Galileo | 40428 | `0x3aCAAf60502791D199a5a5F0B173D78229eBFe32` | `0xa78a78a13074ed93ad447a26ec57121f29e8fec2` |
| Base Sepolia | 40245 | `0x6EDCE65403992e310A62460808c4b910D972f10f` | `0xe1a12515f9ab2764b887bf60b923ca494ebbb2d6` |

**Two OApps, deliberately split:**
- `BountyMessenger` (0G) — emits `notifyCompletion(bountyId, recipients[], amounts[])` to the Base counterpart when a bounty's synthesis lands.
- `PaymentMessenger` (Base) — receives via `_lzReceive`, decodes, emits `DistributeRequested(messageGuid, srcEid, bountyId, srcSender, recipients, amounts)`.

KeeperHub's role on Base side: a workflow watches `DistributeRequested` events and calls `PaymentRouter.distribute()` via Direct Execution API. Gas estimation, retry on failure, and full audit log are KH's job. The split is deliberate: **LayerZero proves the message, KeeperHub ensures the resulting tx lands.** Neither layer pretends to do the other's job.

OApp source: [`contracts/src/BountyMessenger.sol`](./contracts/src/BountyMessenger.sol), [`contracts/src/PaymentMessenger.sol`](./contracts/src/PaymentMessenger.sol).

**Deployed and live (Day 5 / 2026-04-27):**

| Contract | Address |
|---|---|
| `BountyMessenger` (0G Galileo) | [`0x55b4bccdef026c8cbf5ab495a85aa28f235a4fed`](https://chainscan-galileo.0g.ai/address/0x55b4bccdef026c8cbf5ab495a85aa28f235a4fed) |
| `PaymentMessenger` (Base Sepolia) | [`0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4`](https://sepolia.basescan.org/address/0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4) |

First cross-chain message landed end-to-end ([Spike 9 PASS](#spike-results)):
- 0G send tx: [`0x2f758adf…ad47`](https://chainscan-galileo.0g.ai/tx/0x2f758adf57c491466b2c73aa40f1410fc114abca246fb41ca45619984a36ad47)
- LayerZero scan: [`testnet.layerzeroscan.com/tx/0x2f758adf…`](https://testnet.layerzeroscan.com/tx/0x2f758adf57c491466b2c73aa40f1410fc114abca246fb41ca45619984a36ad47)
- Base receive tx: [`0x73a02576…a5bc`](https://sepolia.basescan.org/tx/0x73a0257686d534242b5cc570727e2b9c042b9e8aa210226e379fc3d68ceca5bc)
- GUID `0x565ff853bb84954764b6d2546d40d37fb47c00aa4ea71f08829f0474389c9e45`, fee 0.345 OG, latency ~40s.

## Execution via KeeperHub

KH integrates on **two surfaces** simultaneously, which is unusual:

1. **REST Direct Execution API** — hot path. KH wallet `0x7109C8e3B56C0A94729F3f538105b6916EF5934B` is whitelisted as the keeper on `PaymentRouter`. End-to-end transfer verified live (Spike 4): tx [`0x6ca23a64…`](https://sepolia.basescan.org/tx/0x6ca23a6491cd17fea40d3e9a866d3028a98709bfc548bd0bf98966e2e51f921b).
2. **Hosted MCP Server** at `https://app.keeperhub.com/mcp` — workflow discovery + orchestration. 26 tools listed live (Spike 8) including `list_workflows`, `execute_workflow`, `ai_generate_workflow`, `get_execution_logs`, `execute_contract_call`, `search_protocol_actions`.

`@scholar-swarm/keeperhub-client` ships both `KeeperHubPaymentProvider` (REST) and `KeeperHubMCPClient` (Streamable HTTP).

**Builder Feedback Bounty submission** — six concrete actionable items:
- `wfb_` vs `kh_` token type distinction was undocumented at API level.
- `/api/chains` endpoint shows 20 chains; FAQ claims 6. Mismatch unreconciled.
- `network: ethereum-sepolia` is rejected; canonical is `sepolia` or `eth-sepolia` — not in Direct Execution docs.
- Status URL is `/api/execute/{id}/status` (suffix), not `/api/execute/status/{id}` (prefix).
- `network: 0g` returns `Unsupported`, but `/api/integrations/0g` returns 401 — suggests an integration scaffold without an active backend.
- `docs.keeperhub.com` blocks anonymous browsers (User-Agent filter), making AI tooling research harder.

## Mesh via AXL

Gensyn AXL is the inter-agent backbone. Without AXL, a centralized message broker would replace it — defeating the *trustless multi-agent* claim.

- **2-node local mesh verified** — peer ed25519 IDs `bddf078f…` ⇄ `55f1e064…`, "hello scholar swarm" delivered bidirectionally over Yggdrasil. ([Spike 2a PASS](#spike-results))
- **MCP-over-AXL verified** — `POST /mcp/{peer_id}/{service}` round-trips through a mock router. This is the *peer-hosted tool* pattern that lets a Researcher's locally-hosted Tavily MCP serve all agents through the mesh. ([Spike 3 PASS](#spike-results))
- **`@scholar-swarm/axl-client`** — typed `AXLMessagingProvider` wrapping the local HTTP API at `:9002`.

Cross-ISP test (Spike 2b, laptop-TR ⇄ Hetzner-DE) lands Day 7-10 once VPS is provisioned.

---

## Sponsor track positioning

Three slots used; ETHGlobal allows multiple tracks per partner to count as one slot.

| Slot | Sponsor | Tracks | Pool |
|---|---|---|---|
| 1 | **0G Labs** | Best Agent Framework + Best Autonomous Agents/Swarms/iNFT (dual) | $15k addressable |
| 2 | **Gensyn AXL** | Best Application of AXL | $5k |
| 3 | **KeeperHub** | Best Use of KH + Builder Feedback bonus | $4.5k + $500 |

For each, our positioning paragraph is in [`docs/sponsor-pitches.md`](./docs/sponsor-pitches.md) (Day 11 polish).

---

## Spike results

Each spike is a small standalone script that verifies one architectural assumption against live infrastructure. Six pass with on-chain or live-API proof.

| # | Spike | Status | Proof |
|---|---|---|---|
| 1 | 0G Compute sealed inference | ✅ PASS | qwen2.5-7b TeeML, attestation valid, tool use yes (calculator(18*24)→432). TXs `0x71bbe4e7…`, `0x777aed7e…`. |
| 2a | AXL local mesh | ✅ PASS | 2 `node.exe` instances, "hello scholar swarm" delivered. |
| 2b | AXL cross-ISP mesh | ⏳ pending | Hetzner provisioning Day 7-10. |
| 3 | MCP-over-AXL | ✅ PASS | `/mcp/{peer}/test-service` round-trip via mock router. |
| 4 | KeeperHub Direct Execution | ✅ PASS | Live Base Sepolia transfer tx `0x6ca23a64…`. |
| 5 | 0G Storage roundtrip | ✅ PASS | put 297B → root `0x42408920…`, get 2.3s, content equal. |
| 7 | ERC-8004 + ERC-7857 spec | ✅ design | `AgentNFT` unifies both standards in one contract. |
| 8 | KeeperHub MCP Streamable HTTP | ✅ PASS | 26 tools live, `list_workflows` + `list_action_schemas` confirmed. |

Full artifacts: [`docs/spike-artifacts/`](./docs/spike-artifacts/).

---

## SDK position — `@scholar-swarm/sdk`

A swarm-first agent framework in the OpenClaw family.

| | OpenClaw | Scholar Swarm SDK |
|---|---|---|
| Topology | 1 agent ⇄ N channels | N agents ⇄ 1 workflow |
| Config surface | `SOUL.md` / `TOOLS.md` (declarative) | `Role` subclass + provider injection (code) |
| Identity | Local user wallet | Per-agent on-chain ERC-7857 + ERC-8004 |
| Coordination | Local Gateway | P2P mesh (AXL) |
| Memory | Filesystem | 0G Storage (KV / log / blob) |
| Inference | Pluggable, often centralized | 0G Compute sealed inference (TEE-attested) |
| Best for | Personal assistants, prosumer chatbots | Multi-party workflows where outputs are paid for |

The two are complementary. Full primitives + adapter list in [`packages/swarm-sdk/README.md`](./packages/swarm-sdk/README.md).

---

## Repo layout

```
scholar-swarm/
├── README.md                          ← you are here
├── PLAN.md                            ← execution plan, scope lock, spikes
├── package.json                       ← pnpm workspace root
│
├── contracts/                         ← Foundry, Solc 0.8.27 + via_ir
│   ├── src/
│   │   ├── AgentNFT.sol               ← ERC-7857 + ERC-8004 unified
│   │   ├── ReputationRegistry.sol
│   │   ├── ArtifactRegistry.sol
│   │   ├── Bounty.sol  ·  BountyFactory.sol
│   │   ├── PaymentRouter.sol          ← Base Sepolia
│   │   ├── BountyMessenger.sol        ← LZ V2 OApp on 0G
│   │   ├── PaymentMessenger.sol       ← LZ V2 OApp on Base
│   │   └── interfaces/
│   ├── test/                          ← 34 tests, all pass
│   └── script/                        ← Deploy0G, DeployBase, DeployMessengers0G
│
├── packages/
│   ├── shared/
│   ├── swarm-sdk/                     ← The reusable framework
│   ├── og-client/                     ← Inference + Storage adapters
│   ├── axl-client/                    ← Messaging adapter
│   ├── keeperhub-client/              ← Payment + MCP adapters
│   └── mcp-tools/                     ← Tavily MCP wrapper
│
├── apps/
│   ├── agent-planner/  ·  agent-researcher/
│   ├── agent-critic/   ·  agent-synthesizer/
│   └── frontend/                      ← Day 9-10
│
├── scripts/                           ← spike-01…08 + mint-agents
├── infra/                             ← AXL nodes, mock MCP router
└── docs/                              ← deployment.md, sponsor-reference.md, spike-results.md
```

---

## Quick start

> Requires Node 20+, pnpm 9+, Foundry, and a 0G Galileo testnet wallet with at least 5 OG. The Discord faucet at https://discord.gg/0glabs grants this on request.

```bash
git clone https://github.com/Himess/scholar-swarm   # public Day 11
cd scholar-swarm
pnpm install
forge install --root contracts
cp .env.example .env                                 # fill keys

pnpm spike:01   # 0G Compute (~5 OG required)
pnpm spike:05   # 0G Storage roundtrip
pnpm spike:08   # KeeperHub MCP

pnpm mint:agents   # mint the 5 iNFTs to your wallet

# 2-node AXL mesh
cd infra/axl-node-a && ./node.exe -config node-config.json &
cd infra/axl-node-b && ./node.exe -config node-config.json &
```

Full deployment instructions and on-chain addresses in [`docs/deployment.md`](./docs/deployment.md).

---

## Honest known limitations

We document our own gaps so judges don't have to find them.

1. **Critic and Researcher run on the same testnet model.** 0G Galileo only has one chatbot service (`qwen-2.5-7b-instruct`). We mitigate with different system prompts + independent attestations, but genuine cross-model verification waits for mainnet (7 chatbots available).
2. **Retrieval bias.** Tavily covers open-web well; paywalled sources (Bloomberg, WSJ) are skipped.
3. **Same-operator collusion is auditable but not prevented.** Five distinct agent wallets in the demo make it visible. World ID for sybil resistance is the v2 answer.
4. **Demo agent wallets are funded from one dev account.** Each iNFT is owned by a distinct EOA; those EOAs are funded hierarchically for testnet convenience. Production agents would self-fund from earned payouts.
5. **Reputation cold-start is seeded.** Demo agents ship with reputation reflecting prior test runs (12 jobs, etc.) — documented in `mint-agents.ts`. A live system needs a real bootstrapping mechanism.
6. **TEE re-encryption is stubbed.** `StubVerifier` accepts any ERC-7857 re-encryption proof. Production replaces this with a dstack-bound oracle.
7. **Cross-chain message direction is one-way at MVP.** Bounty completion → payout (0G → Base) ships. Reverse direction (Base USDC fund → 0G bounty bind) follows the same pattern but isn't in the demo path.
8. **Economic viability at small bounty sizes.** Five-way fee split assumes >$50 jobs.

---

## Day-by-day

| Day | Date | Highlights |
|---|---|---|
| 0 | 2026-04-24 | Stake, Discord, plan locked |
| 1 | 2026-04-25 | Monorepo, 10 workspace stubs |
| 2 | 2026-04-26 | Sponsor SDK research, 508KB 0G docs archived |
| 3 | 2026-04-27 | 6 contracts deployed on 0G + 1 on Base; 34 tests pass; Spike 1, 4, 5 PASS |
| 4 | 2026-04-27 | OpenClaw SDK framing, 5 iNFTs minted, AXL mesh + MCP-over-AXL PASS, KH MCP client (26 tools), LZ V2 OApps written |
| 5 | 2026-04-28 | LZ deploy + peer wiring + first cross-chain message; 5 distinct operator wallets; iNFT royalty hook |
| 6 | 2026-04-29 | 0G Storage KV mode; agent runtime on-chain calls |
| 7-8 | Apr 30 – May 1 | Buffer + Hetzner VPS + cross-ISP test |
| 9 | May 2 | Single-machine E2E dry run |
| 10 | May 3 | Two-machine demo dry run |
| 11 | May 4 | Demo video + README polish + sponsor pitches + FEEDBACK.md |
| 12 | May 5 | Submission |

---

## Team

Solo build by **Semih Civelek** ([@Himess](https://github.com/Himess)) from Ordu, Türkiye. 80+ merged PRs across Ethereum OSS (reth, revm, Optimism, Base, Miden). Prior win: Zama Builder Track S1 with MARC.

## License

MIT. Top to bottom — SDK, contracts, agent runtimes.
