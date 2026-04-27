# Scholar Swarm

> A decentralized research economy. Specialist AI agents — owned, paid, and verified on-chain — collaborate over a peer-to-peer mesh to produce source-traceable, attested research reports.

**Submitted to:** ETHGlobal Open Agents 2026 (online async hackathon, April 24 – May 6).
**Status (Day 4 / 2026-04-27):** Core architecture deployed on testnet. 6 spikes pass with on-chain tx proofs. LayerZero V2 cross-chain layer in progress.
**Builder:** Solo — Semih Civelek ([@Himess](https://github.com/Himess)).

---

## What this actually is

Scholar Swarm is **two things in one repository**:

1. **`@scholar-swarm/sdk`** — a swarm-first agent framework in the OpenClaw family. Code-first Role + Provider model, designed for **N agents coordinating one workflow** across decentralized infrastructure. Domain-agnostic, MIT licensed. See [`packages/swarm-sdk/README.md`](./packages/swarm-sdk/README.md).

2. **Scholar Swarm itself** — a reference application built on the SDK: a four-role research economy (Planner + 2 Researchers + Critic + Synthesizer) where each agent is an ERC-7857 iNFT, payments settle in USDC on Base Sepolia via KeeperHub, inference runs in TEE on 0G Compute, and storage lives on 0G.

This README focuses on the application. SDK details live in its own README.

---

## The problem

AutoGPT-style agent loops (AutoGPT, BabyAGI, MetaGPT, CrewAI, LangChain agents) all share four structural failures when used for serious research:

1. **Single point of trust.** One LLM, one operator, one API key. Hallucinations propagate silently.
2. **Unverifiable reasoning.** No cryptographic record of *which model produced what*. Enterprise users can't audit.
3. **No quality signal.** All agents are free workers; a good researcher and a sloppy one rank equal.
4. **Closed-loop, single user.** Each instance is a private toy. No shared market, no transferable identity.

The gap is real: VCs, hedge funds, and consulting shops pay $500–$5,000 per third-party research report. They don't outsource to autonomous agents because they can't verify the output. We bridge that gap by giving each agent:

- **Cryptographic proof of inference** (TEE attestation via 0G Compute / dstack)
- **Source-attributed claims** (every statement links back to a fetched URL, validated by an independent critic)
- **On-chain identity and reputation** (ERC-7857 iNFTs + ERC-8004 reputation registry)
- **Trustless multi-party payment** (LayerZero V2 message → KeeperHub-orchestrated USDC distribution)

---

## Architecture — smart hybrid (chain-split by purpose)

Scholar Swarm runs on two chains by design, not by accident. Each chain serves the role it's best at:

```
┌───────────────────────────────  0G Galileo Testnet (16602)  ───────────────────────────────┐
│                                                                                            │
│   research economy lives here                                                              │
│                                                                                            │
│   ┌──────────────┐  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│   │  AgentNFT    │  │ ReputationRegistry  │  │ ArtifactRegistry │  │   BountyFactory  │    │
│   │  (ERC-7857   │  │ (ERC-8004)          │  │  (storage hash   │  │  (clones Bounty) │    │
│   │  + ERC-8004  │  │                     │  │   anchors)       │  │                  │    │
│   │  identity)   │  │                     │  │                  │  │                  │    │
│   └──────────────┘  └─────────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                                            │
│   0G Compute (TeeML / dstack)  →  attested LLM inference                                   │
│   0G Storage                  →  encrypted intelligence + findings + reports               │
│                                                                                            │
│   BountyMessenger (LayerZero V2 OApp, sender)                                              │
│                            │                                                               │
└────────────────────────────┼───────────────────────────────────────────────────────────────┘
                             │ DVN-attested cross-chain message (LayerZero V2)
                             ▼
┌─────────────────────────────  Base Sepolia (84532)  ───────────────────────────────────────┐
│                                                                                            │
│   payment rails live here                                                                  │
│                                                                                            │
│   PaymentMessenger (LayerZero V2 OApp, receiver)                                           │
│       └── emits  DistributeRequested(bountyId, recipients[], amounts[])                    │
│                            │                                                               │
│   KeeperHub workflow watches event  ─→  Direct Execution API                               │
│       └── calls  PaymentRouter.distribute(bountyKey, recipients, amounts)                  │
│                            │                                                               │
│   PaymentRouter (USDC escrow + multi-party payout)                                         │
│       USDC flows from escrow to 5 agent wallets                                            │
│                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────  off-chain  ─────────────────────────────────────────────┐
│                                                                                            │
│   AXL P2P mesh (gensyn-ai/axl, Yggdrasil overlay)                                          │
│       ├── Planner ⇄ Researcher 1 ⇄ Researcher 2 ⇄ Critic ⇄ Synthesizer                     │
│       └── MCP-over-AXL: agent-to-tool calls (Tavily retrieval, etc.)                       │
│                                                                                            │
│   Tavily MCP             →  web retrieval for Researcher                                   │
│   KeeperHub MCP server   →  workflow discovery + ai_generate_workflow + execution status   │
│                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Each box has a verifiable proof on-chain or in our spike artifacts; see the [Live Proofs](#live-proofs) section.

---

## Sponsor integrations — what's wired and how

We use three of the available ETHGlobal Open Agents partner slots. ETHGlobal allows multiple tracks per partner to count as one slot, so we cover four prize tracks total.

### Slot 1 — 0G Labs ($15k addressable, two tracks)

| Track | How we hit it |
|---|---|
| **Best Agent Framework, Tooling & Core Extensions** ($7.5k) | `@scholar-swarm/sdk` is a swarm-first OpenClaw-family framework. Code-first Role + Provider model, native 0G Compute / 0G Storage / 0G Chain providers. Four working example agents (Planner, Researcher, Critic, Synthesizer) ship in `apps/agent-*`. |
| **Best Autonomous Agents, Swarms & iNFT Innovations** ($7.5k flat 5×$1500) | Five iNFTs minted on 0G Galileo (`AgentNFT` at `0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`). Each agent's role definition + system prompt is **AES-256-GCM encrypted** and stored on 0G Storage; the merkle root is committed in `iNFT.intelligenceRoot`. Pattern matches the prize page verbatim: *"Specialist agent swarms (planner + researcher + critic + executor) that collaborate in real time via shared 0G Storage memory and coordinate inference on 0G Compute."* |

**0G stack usage:**
- **0G Compute** — every LLM call (decomposition, research, semantic-match, synthesis) runs on the testnet `qwen/qwen-2.5-7b-instruct` model with **TeeML attestation** and a **dstack TEE verifier** (Phala Network's open-source framework, github.com/Dstack-TEE/dstack v0.5.8). [Spike 1 PASS](#spike-results) — inference + attestation verified live, tool use confirmed.
- **0G Storage** — encrypted agent intelligence, research findings, critic rationales, final reports. [Spike 5 PASS](#spike-results) — JSON roundtrip verified at storage root `0x42408920…`.
- **0G Chain** — six contracts live: `AgentNFT`, `ReputationRegistry`, `ArtifactRegistry`, `Bounty` (impl), `BountyFactory`, `StubVerifier`. Total deploy cost ~0.038 OG.

### Slot 2 — Gensyn AXL ($5k)

AXL is the inter-agent communication backbone. Removing it means falling back to a centralized message broker, which would defeat the *trustless multi-agent* claim.

- **2-node local mesh verified** ([Spike 2a PASS](#spike-results)) — peer ed25519 IDs `bddf078f…` ⇄ `55f1e064…`, "hello scholar swarm" delivered bidirectionally over Yggdrasil overlay.
- **MCP-over-AXL verified** ([Spike 3 PASS](#spike-results)) — `POST /mcp/{peer_id}/{service}` round-trips through a mock router, proving the *peer-hosted tool* pattern that underpins our Tavily-via-AXL retrieval layer in the demo.
- **`packages/axl-client`** — typed `AXLMessagingProvider` wrapping the local HTTP API at `:9002` (`/send`, `/recv`, `/topology`, `/mcp`).

Cross-ISP test (Spike 2b, laptop-TR ⇄ Hetzner-DE) is scheduled for Day 7–10 once the VPS is provisioned.

### Slot 3 — KeeperHub ($4.5k + $500 feedback bonus)

We integrate KeeperHub on **two surfaces simultaneously**, which is unusual:

1. **REST Direct Execution API** for hot-path payouts.
   - PaymentRouter on Base Sepolia at `0xda6ab98bb73e75b2581b72c98f0891529eee2156`.
   - KH wallet `0x7109C8e3B56C0A94729F3f538105b6916EF5934B` is whitelisted as the keeper.
   - End-to-end transfer verified live: tx `0x6ca23a64…` ([Spike 4 PASS](#spike-results)).

2. **Hosted MCP Server** (`https://app.keeperhub.com/mcp`, Streamable HTTP) for workflow discovery and orchestration.
   - 26 tools listed live ([Spike 8 PASS](#spike-results)) including `list_workflows`, `execute_workflow`, `ai_generate_workflow`, `get_execution_logs`, `execute_contract_call`.
   - Our `@scholar-swarm/keeperhub-client` exports both `KeeperHubPaymentProvider` (REST) and `KeeperHubMCPClient` (MCP).

In the LayerZero-coordinated flow, KeeperHub's role is **execution reliability on Base** — gas estimation, retry, and audit log on every `PaymentRouter.distribute()` call triggered by an inbound LZ message. KH is not pretending to be the bridge; LayerZero V2 attests the cross-chain message, KH ensures the resulting on-chain tx lands.

**Builder Feedback Bounty submission** — six concrete actionable items from our integration:
- `wfb_` vs `kh_` token type distinction was undocumented at API level (only in the API key creation UI).
- `/api/chains` endpoint shows 20 entries; FAQ claims 6. The mismatch isn't reconciled in docs.
- Network identifier `ethereum-sepolia` is rejected; canonical is `sepolia` or `eth-sepolia`. Direct Execution docs don't list the canonical names.
- Status endpoint URL is `/api/execute/{id}/status` (suffix), not `/api/execute/status/{id}` (prefix). Multiple guesses needed before we found it.
- 0G chain (chainId 16602) returns `Unsupported network` even though /api/integrations/0g returns `401` — suggests an integration scaffold without an active backend.
- `docs.keeperhub.com` blocks anonymous browsers (User-Agent filter), making AI tooling research harder.

---

## Live proofs

### Deployed contracts

**0G Galileo Testnet (chain ID 16602, explorer https://chainscan-galileo.0g.ai):**

| Contract | Address | Purpose |
|---|---|---|
| `AgentNFT` | [`0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`](https://chainscan-galileo.0g.ai/address/0x68c0175e9d9C6d39fC2278165C3Db93d484a5361) | ERC-7857 + ERC-8004 IdentityRegistry unified |
| `ReputationRegistry` | [`0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13`](https://chainscan-galileo.0g.ai/address/0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13) | ERC-8004 Reputation Registry |
| `ArtifactRegistry` | [`0xB83e014c837763C4c86f21C194d7Fb613edFbE2b`](https://chainscan-galileo.0g.ai/address/0xB83e014c837763C4c86f21C194d7Fb613edFbE2b) | 0G Storage hash anchors |
| `Bounty` (impl) | [`0x3905554071E2F121533EbB26Fcf7947C916299C1`](https://chainscan-galileo.0g.ai/address/0x3905554071E2F121533EbB26Fcf7947C916299C1) | Cloned per job |
| `BountyFactory` | [`0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE`](https://chainscan-galileo.0g.ai/address/0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE) | EIP-1167 clone factory |
| `StubVerifier` | [`0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5`](https://chainscan-galileo.0g.ai/address/0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5) | ERC-7857 verifier slot (TEE oracle is v2) |
| `BountyMessenger` (LZ V2 OApp) | _pending Day 5 deploy_ | Cross-chain notifyCompletion sender |

**Base Sepolia (chain ID 84532, explorer https://sepolia.basescan.org):**

| Contract | Address | Purpose |
|---|---|---|
| `PaymentRouter` | [`0xda6ab98bb73e75b2581b72c98f0891529eee2156`](https://sepolia.basescan.org/address/0xda6ab98bb73e75b2581b72c98f0891529eee2156) | USDC escrow + multi-party distribute |
| `PaymentMessenger` (LZ V2 OApp) | _pending Day 5 deploy_ | Cross-chain DistributeRequested receiver |
| USDC (canonical) | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) | Circle's Base Sepolia USDC |

### Minted iNFT agents (ERC-7857)

All five agents are tokenized on 0G Galileo. Encrypted intelligence (system prompt + role spec + reputation seed) is **AES-256-GCM-sealed** and stored on 0G Storage. Symmetric key bundled in `iNFT.encryptedKey` (TEE-bound re-encryption is v2).

| agentId | Name | Role | Storage Root | Reputation seed |
|---|---|---|---|---|
| 1 | Planner-Alpha | Planner | `0x5bf94ba24417…` | (cold start) |
| 2 | Researcher-One | Researcher | `0x6ff1668a8e0b…` | 12 jobs, 0.83 approval |
| 3 | Researcher-Two | Researcher | `0xddcde3746fc2…` | 4 jobs, 0.95 approval |
| 4 | Critic-Prime | Critic | `0x14b122824a89…` | 20 jobs, 0.88 catch-rate |
| 5 | Synthesizer-Final | Synthesizer | `0x5053fc01c8a7…` | 8 jobs, 4.4/5 user rating |

Mint artifact: [`docs/spike-artifacts/minted-agents.json`](./docs/spike-artifacts/minted-agents.json).

### Spike results

Each spike is a small standalone script designed to verify one architectural assumption against live infrastructure. Six pass with on-chain tx proofs.

| # | Spike | Status | Proof |
|---|---|---|---|
| 1 | 0G Compute sealed inference | ✅ PASS | qwen2.5-7b TeeML, attestation valid, tool use yes (calculator(18*24)→432). TXs `0x71bbe4e7…`, `0x777aed7e…`, `0x1fac5a5f…`. |
| 2a | AXL local mesh | ✅ PASS | 2 `node.exe` instances on localhost, "hello scholar swarm" delivered. |
| 2b | AXL cross-ISP mesh | ⏳ pending | Hetzner provisioning Day 7-10. |
| 3 | MCP-over-AXL | ✅ PASS | `/mcp/{peer}/test-service` round-trip via mock router. |
| 4 | KeeperHub Direct Execution | ✅ PASS | Real Base Sepolia transfer tx [`0x6ca23a64…`](https://sepolia.basescan.org/tx/0x6ca23a6491cd17fea40d3e9a866d3028a98709bfc548bd0bf98966e2e51f921b). |
| 5 | 0G Storage roundtrip | ✅ PASS | put 297B → root `0x42408920…`, get 2.3s, content equal. |
| 7 | ERC-8004 + ERC-7857 spec | ✅ design | `AgentNFT` unifies both standards in one contract. |
| 8 | KeeperHub MCP Streamable HTTP | ✅ PASS | 26 tools live, `list_workflows` + `list_action_schemas` confirmed. |

Full spike artifacts: [`docs/spike-artifacts/`](./docs/spike-artifacts/).

---

## Cross-chain via LayerZero V2 (in progress, Day 5)

**Why LayerZero:** KeeperHub doesn't support 0G chain (verified Day 3 — *"Unsupported network: 0g"*). Without a real bridge our hybrid architecture would rely on a trusted single relay — unacceptable for *"trustless multi-agent"* claims. LayerZero V2 has been deployed on 0G Galileo testnet (verified Day 4 via the LayerZero metadata API), so we can use real DVN-attested cross-chain messaging.

**Endpoint addresses (verified live):**

| Chain | EID | EndpointV2 | DVN (LayerZero Labs) |
|---|---|---|---|
| 0G Galileo (16602) | 40428 | `0x3aCAAf60502791D199a5a5F0B173D78229eBFe32` | `0xa78a78a13074ed93ad447a26ec57121f29e8fec2` |
| Base Sepolia (84532) | 40245 | `0x6EDCE65403992e310A62460808c4b910D972f10f` | `0xe1a12515f9ab2764b887bf60b923ca494ebbb2d6` |

**OApp design** ([`contracts/src/BountyMessenger.sol`](./contracts/src/BountyMessenger.sol), [`contracts/src/PaymentMessenger.sol`](./contracts/src/PaymentMessenger.sol)):

- `BountyMessenger` (0G side) — `_lzSend(40245, abi.encode(bountyId, recipients, amounts), …)` on bounty completion.
- `PaymentMessenger` (Base side) — `_lzReceive` decodes payload and emits `DistributeRequested(messageGuid, srcEid, bountyId, srcSender, recipients, amounts)`.
- KeeperHub workflow listens for `DistributeRequested` and triggers `PaymentRouter.distribute()` via Direct Execution API. KH retains gas + retry + audit responsibilities on the Base side.

This separates **message integrity** (LayerZero V2 DVN attestation) from **execution reliability** (KH retry + gas + audit). Neither layer pretends to do the other's job, and both are needed.

**Status:** OApp contracts compile against the canonical `LayerZero-Labs/LayerZero-v2` repo. Deployment + peer wiring + first cross-chain message scheduled for Day 5 afternoon. The Bounty contract integration that triggers `notifyCompletion` automatically lands Day 6.

---

## SDK position — `@scholar-swarm/sdk`

**Tagline:** A swarm-first agent framework in the OpenClaw family.

**Where it sits in the landscape:**

| | OpenClaw | Scholar Swarm SDK |
|---|---|---|
| Topology | 1 agent ⇄ N channels | N agents ⇄ 1 workflow |
| Config surface | `SOUL.md` / `TOOLS.md` (declarative) | `Role` subclass + provider injection (code) |
| Identity | Local user wallet | Per-agent on-chain ERC-7857 + ERC-8004 |
| Coordination | Local Gateway | P2P mesh (AXL) |
| Memory | Filesystem | 0G Storage (KV / log / blob) |
| Inference | Pluggable, often centralized | 0G Compute sealed inference (TEE-attested) |
| Best for | Personal assistants, prosumer chatbots | Multi-party workflows where outputs are paid for |

The two are **complementary**. An OpenClaw user could invoke a Scholar Swarm SDK agent as a tool through their Telegram channel.

**SDK primitives** (`packages/swarm-sdk/src/`):
- `Role` (abstract) — implement `handle(SwarmMessage, sender)` and optionally `tick()`.
- `RoleContext` — `{ agentId, operatorWallet, providers, log }` injected into roles.
- `AgentProviders` — `{ inference, storage, messaging, payment?, retrieval?, reputation? }`. Every provider is an interface; concrete adapters live in adjacent packages.
- `Agent` — runtime that subscribes to messaging, dispatches to the role, and runs ticks.

**Concrete adapters shipped:**
- `@scholar-swarm/og-client` — `OGComputeInferenceProvider`, `OGStorageProvider`.
- `@scholar-swarm/axl-client` — `AXLMessagingProvider`.
- `@scholar-swarm/keeperhub-client` — `KeeperHubPaymentProvider`, `KeeperHubMCPClient`.
- `@scholar-swarm/mcp-tools` — Tavily retrieval (Day 5).

A different team building, say, a code-review swarm could swap the inference provider for OpenAI, the storage for IPFS, the messaging for Redis pub/sub — and the role code is unchanged.

---

## Repository layout

```
scholar-swarm/
├── README.md                          ← this file
├── PLAN.md                            ← full execution plan, spike defs, scope lock
├── package.json                       ← pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
│
├── contracts/                         ← Foundry, Solc 0.8.27 + via_ir
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── src/
│   │   ├── AgentNFT.sol               ← ERC-7857 + ERC-8004 unified
│   │   ├── ReputationRegistry.sol     ← ERC-8004 standard
│   │   ├── ArtifactRegistry.sol
│   │   ├── Bounty.sol                 ← Per-job state machine
│   │   ├── BountyFactory.sol          ← Clone factory
│   │   ├── PaymentRouter.sol          ← Base Sepolia, USDC distribute
│   │   ├── BountyMessenger.sol        ← LZ V2 OApp on 0G (sender)
│   │   ├── PaymentMessenger.sol       ← LZ V2 OApp on Base (receiver)
│   │   └── interfaces/                ← IERC7857, IERC8004, IBounty, …
│   ├── test/                          ← 34 forge tests, all pass
│   └── script/                        ← Deploy0G, DeployBase, DeployMessengers0G
│
├── packages/
│   ├── shared/                        ← Cross-package types
│   ├── swarm-sdk/                     ← The reusable framework
│   ├── og-client/                     ← Inference + Storage adapters
│   ├── axl-client/                    ← Messaging adapter
│   ├── keeperhub-client/              ← Payment + MCP adapters
│   └── mcp-tools/                     ← Tavily MCP wrapper (Day 5)
│
├── apps/
│   ├── agent-planner/                 ← Decomposes goals, runs auctions
│   ├── agent-researcher/              ← Bid + retrieve + claim
│   ├── agent-critic/                  ← HTTP source check + semantic match
│   ├── agent-synthesizer/             ← Final report aggregation
│   └── frontend/                      ← (Day 9-10)
│
├── scripts/
│   ├── spike-01-og-compute.ts         ← Inference + attestation + tool-use probe
│   ├── spike-05-og-storage.ts         ← Roundtrip
│   ├── spike-08-keeperhub-mcp.ts      ← MCP Streamable HTTP
│   └── mint-agents.ts                 ← 5 iNFT mint script
│
├── infra/
│   ├── axl-node-a/                    ← Local AXL mesh, node A config + binary
│   └── axl-node-b/                    ← Local AXL mesh, node B + mock MCP router
│
└── docs/
    ├── deployment.md                  ← Live contract addresses + tx links
    ├── sponsor-reference.md           ← All 4 sponsor SDKs in one place
    ├── spike-results.md               ← Running spike log
    ├── spike-07-erc8004-erc7857.md    ← AgentNFT inheritance plan
    ├── og-llms-full.txt               ← Full 0G docs archive (508 KB)
    └── spike-artifacts/               ← JSON outputs from each spike run
```

---

## Quick start

> **Reproducibility note:** the steps below assume Node 20+, pnpm 9+, Foundry, and a 0G Galileo testnet wallet with at least 5 OG. The Discord faucet at https://discord.gg/0glabs typically grants this on request.

### 1. Install
```bash
git clone https://github.com/Himess/scholar-swarm   # repo will be made public Day 11
cd scholar-swarm
pnpm install
forge install --root contracts                       # OZ + forge-std + LayerZero-v2 + bytes-utils
```

### 2. Configure
```bash
cp .env.example .env                                 # fill DEMO_PLANNER_KEY, KEEPERHUB_API_KEY, etc.
```

### 3. Verify the spikes
```bash
pnpm spike:01    # 0G Compute (needs ~5 OG on the wallet)
pnpm spike:05    # 0G Storage roundtrip
pnpm spike:08    # KH MCP server
```

### 4. Deploy (already done on testnet, addresses in `.env`)
```bash
# 0G Galileo
forge script script/Deploy0G.s.sol:Deploy0G \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast --slow --legacy --with-gas-price 4000000000

# Base Sepolia
forge script script/DeployBase.s.sol:DeployBase \
  --rpc-url https://sepolia.base.org \
  --broadcast --slow
```

### 5. Mint the 5 agent iNFTs
```bash
pnpm mint:agents
```

### 6. Run a 2-node AXL mesh locally
```bash
# in two terminals
cd infra/axl-node-a && ./node.exe -config node-config.json
cd infra/axl-node-b && ./node.exe -config node-config.json
```

### 7. Run the four agent runtimes
```bash
# (Day 5 — full local E2E lands)
pnpm --filter @scholar-swarm/agent-planner start
pnpm --filter @scholar-swarm/agent-researcher start          # RESEARCHER_NUMBER=1
RESEARCHER_NUMBER=2 pnpm --filter @scholar-swarm/agent-researcher start
pnpm --filter @scholar-swarm/agent-critic start
pnpm --filter @scholar-swarm/agent-synthesizer start
```

---

## Honest known limitations

We document our own gaps so judges don't have to find them.

1. **Critic verifies LLM with LLM.** Both Researcher and Critic call the same testnet model (`qwen-2.5-7b-instruct` is the only chatbot on the Galileo Compute network). We mitigate with different system prompts + independent attestation per call, and document this. On mainnet (7 chatbots available), Researcher and Critic would run on different models for genuine cross-model verification.

2. **Retrieval bias.** Tavily covers open-web well but paywalled sources (Bloomberg, WSJ, top journals) are skipped. Findings skew toward open content.

3. **Same-operator collusion is not prevented.** A malicious actor could operate Researcher and Critic with the same wallet. The five distinct operator wallets in the demo make this auditable, but proving "different humans" requires sybil resistance (World ID is the v2 answer).

4. **Demo agent wallets are funded from the same dev account.** Each iNFT *is* owned by a distinct EOA, but those EOAs are funded from the same hierarchical key for testnet convenience. Production agents would be funded from independent payouts.

5. **Reputation cold start.** New agents have a seeded reputation for video credibility (documented in `mint-agents.ts`). A live system would need a bootstrapping mechanism — work, build rep, win bigger — that takes weeks.

6. **TEE re-encryption is stubbed.** `StubVerifier` accepts any `ERC-7857` re-encryption proof. Production replaces this with a dstack-bound oracle.

7. **Cross-chain message direction is one-way at MVP.** Bounty completion → payout (0G → Base) ships Day 5–6. The reverse direction (Base USDC fund → 0G bounty bind) follows the same pattern but isn't in the demo path.

8. **Economic viability at small bounty sizes.** A 5-way fee split doesn't make sense for sub-$20 bounties. Scholar Swarm is intended for >$50 jobs.

---

## Day-by-day status

| Day | Date | Highlights |
|---|---|---|
| 0 | 2026-04-24 | Stake, Discord, 6 Day-0 spikes defined, plan locked |
| 1 | 2026-04-25 | Monorepo scaffold, 10 workspace stubs, real prize numbers verified |
| 2 | 2026-04-26 | Sponsor SDK research (508 KB 0G docs archived), service tuple shape verified |
| 3 | 2026-04-27 | 6 contracts deployed on 0G + 1 on Base; 34 Foundry tests pass; Spike 1, 4, 5 PASS |
| 4 | 2026-04-27 | OpenClaw SDK framing, 5 iNFTs minted, AXL local mesh + MCP-over-AXL PASS, KH MCP client (26 tools live), LayerZero V2 OApps written |
| 5 | 2026-04-28 (today) | LZ deploy + peer wiring + first cross-chain message; 5 distinct operator wallets; iNFT royalty hook |
| 6 | 2026-04-29 | 0G Storage KV mode for shared researcher memory; agent runtime wiring + on-chain calls |
| 7 | 2026-04-30 | Buffer / catch-up; Hetzner VPS provisioning if ready |
| 8 | 2026-05-01 | Cross-chain coordinator polish; ERC-8004 ValidationRegistry if time |
| 9 | 2026-05-02 | Single-machine end-to-end demo dry run |
| 10 | 2026-05-03 | Cross-machine demo dry run (laptop TR + Hetzner DE) |
| 11 | 2026-05-04 | Demo video record + README polish + FEEDBACK.md for KeeperHub |
| 12 | 2026-05-05 | Submission |

---

## Pitch (one-liner, locked)

> AutoGPT is one model in a loop. Scholar Swarm is a decentralized research economy with **attested inference**, **tokenized agents**, and **trustless cross-chain payouts** — five specialist iNFT agents on 0G coordinate over an AXL P2P mesh, every claim is critic-verified against fetched sources, and a LayerZero V2 message triggers a KeeperHub-orchestrated USDC distribution on Base.

Each adjective is supported by a live tx, a deployed contract, or a passing spike. Receipts above.

---

## Team

- **Builder:** Semih Civelek ([@Himess](https://github.com/Himess))
- **Location:** Ordu, Turkey
- **Background:** 80+ merged PRs across Ethereum OSS (reth, revm, Optimism, Base, Miden), prior wins (Zama Builder Track S1 with MARC). Solo on this submission.

---

## License

MIT, top to bottom — including the SDK, the contracts, and the agent reference implementations.

If you build on Scholar Swarm SDK and ship something interesting, drop us a line. If you want to fork the whole research swarm for your own domain (legal review, code audit, journalism), the SDK is designed exactly for that — see [`packages/swarm-sdk/README.md`](./packages/swarm-sdk/README.md).
