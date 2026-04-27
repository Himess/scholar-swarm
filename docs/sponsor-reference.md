# Sponsor Reference — verified API surfaces (Day 0/1)

> Canonical URLs + SDK snippets. Updated as we hit docs.
> Source of truth when writing spike scripts and integration code.

---

## 0G Labs

### Network: Galileo Testnet

| Field | Value |
|---|---|
| Name | 0G-Galileo-Testnet |
| Chain ID | 16602 |
| Native token | OG |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Storage Explorer | `https://storagescan-galileo.0g.ai` |
| Faucet | `https://faucet.0g.ai` (0.1 OG/day/wallet) |
| GCloud Faucet | `https://cloud.google.com/application/web3/faucet/0g/galileo` |

**Storage contracts (testnet):**
- Flow: `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`
- Mine: `0x00A9E9604b0538e06b268Fb297Df333337f9593b`
- Reward: `0xA97B57b4BdFEA2D0a25e535bd849ad4e6C440A69`
- DAEntrance: `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B`

**⚠️ Funding (deflated, was a blocker):** 0G Compute needs 3 OG (ledger) + 1 OG per provider sub-account. **Inference itself is cheap — 0.05–0.10 0G per 1M tokens.** Full demo run uses ~0.01 0G of inference. So we need ~4 OG total per shared inference wallet. Faucet 0.1 OG/day still tight; mitigation = Discord ask + multiple wallets. See §Funding Strategy below.

### 0G Compute — SDK

```bash
pnpm add @0glabs/0g-serving-broker
# Additional crypto deps if building for browser:
pnpm add @types/crypto-js@4.2.2 crypto-js@4.2.0
```

**Broker init (Node.js):**
```ts
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const RPC_URL = "https://evmrpc-testnet.0g.ai";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);
```

**List services (models):**
```ts
const services = await broker.inference.listService();
// Filter: serviceType === 'chatbot' | 'text-to-image' | 'speech-to-text'
// Each has: providerAddress, model, serviceType, ...
```

**Account funding (ONCE per wallet):**
```ts
await broker.ledger.depositFund(10);                        // Main account, min 3 OG
await broker.ledger.transferFund(                            // Sub-account per provider, min 1 OG
  providerAddress,
  "inference",
  BigInt(1) * BigInt(10 ** 18)
);
```

**Chat inference (OpenAI-compatible):**
```ts
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress);

const res = await fetch(`${endpoint}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello!" }],
    model,
  }),
});
const data = await res.json();
// data.choices[0].message.content
```

**TEE attestation verification:**
```ts
const chatID = res.headers.get("ZG-Res-Key") ?? data.id;
const isValid = await broker.inference.processResponse(providerAddress, chatID);
// returns true/false — cryptographic signature verification on TEE output
```

**Provider verification (optional, for Framework track credibility):**
```ts
const result = await broker.inference.verifyService(
  providerAddress,
  "./reports",
  (step) => console.log(step.message),
);
// result.signerVerification.allMatch && result.composeVerification.passed
```

**Constraints:**
- Rate limit: 30 req/min per user, 5 concurrent max
- Delayed fee settlement (fees not deducted per-call)
- Endpoint is OpenAI-compatible — means tool calls via standard `tools` field MAY work per provider. Must test per model in Spike 1.

### 0G Storage — SDK

```bash
pnpm add @0gfoundation/0g-ts-sdk ethers
```

```ts
import { ZgFile, MemData, Indexer, Batcher, KvClient } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";

const RPC_URL = "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const indexer = new Indexer(INDEXER_RPC);

// In-memory upload (our use case — JSON findings)
const data = new TextEncoder().encode(JSON.stringify({ claims: [...] }));
const memData = new MemData(data);
const [tree, treeErr] = await memData.merkleTree();
const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, signer);
const rootHash = tree!.rootHash();

// Download by root hash
await indexer.download(rootHash, outputPath, /* withProof */ true);

// KV (for shared memory between researchers)
const kvClient = new KvClient("http://3.101.147.150:6789"); // verify in spike
const value = await kvClient.getValue(streamId, ethers.encodeBase64(keyBytes));
```

**Repos:**
- TS SDK: `github.com/0gfoundation/0g-ts-sdk`
- TS starter: `github.com/0gfoundation/0g-storage-ts-starter-kit`

### Funding Strategy (Galileo Testnet)

Faucet gives 0.1 OG/day/wallet. We need:
- 5 agent wallets (Planner, R1, R2, Critic, Synthesizer) × (3 OG ledger + 2 OG provider subs) = 25 OG total
- User demo wallet: 1-2 OG for bounty escrow + gas

**Options:**
1. **Start faucet grind today** on all 7 wallets in parallel (0.7 OG/day total → 25 OG in ~36 days — too slow)
2. **Hackathon-specific faucet:** ask in ETHGlobal / 0G Discord for increased faucet for participants
3. **GCloud faucet:** second source, may have different limit — test today
4. **Shared wallet for inference, distinct wallets for on-chain identity:** cheapest — only ONE wallet funds inference (shared ledger), but each agent has its own signing key for on-chain reputation. Inference attestation still valid because it's bound to provider, not caller. **This is the viable option.**

**Decision:** Shared funding wallet for inference; per-agent wallet for on-chain identity (contract calls, reputation). Document in README.

---

## Gensyn AXL

### Install & Run

```bash
git clone https://github.com/gensyn-ai/axl
cd axl && make build
openssl genpkey -algorithm ed25519 -out private.pem
./node -config node-config.json
```

- Language: Go (make build)
- Binary: `./node`
- Config: `node-config.json` (schema TBD — check repo)
- Identity: ed25519 keypair → peer ID derived from public key

### Architecture

- Base: Yggdrasil (decentralized IPv6 overlay, NAT-traversing by default)
- Network: gVisor userspace TCP (no TUN, no root)
- Transport: JSON-RPC wrapped in envelope

### HTTP API (`localhost:9002`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/send` | POST | Send payload to destination peer ID |
| `/recv` | GET | Poll for inbound messages |
| `/topology` | GET | List known peers / network graph |
| `/mcp/{peer_id}/{service}` | POST | Call remote MCP service on peer |
| `/a2a/{peer_id}` | POST | Call remote A2A agent on peer |

### MCP Integration (critical for pitch)

AXL natively proxies MCP servers between peers:
- Peer A runs MCP server locally (e.g., Tavily wrapper)
- Peer A registers service with AXL
- Peer B calls via `POST /mcp/{peer_a_id}/tavily-search`
- AXL routes over Yggdrasil mesh, end-to-end encrypted
- No DNS, no public IP, no tunneling

**This is the "Remove AXL and the system needs a central relay" angle.** Plan A of §8.2 in PLAN.md is real.

### A2A Integration

Routes to local A2A server exposing agent skills. Counterpart to MCP — agent calls agent by peer ID.

### Docs references

- Main (403 gated from here): `https://docs.gensyn.network`
- Alt: `https://docs.gensyn.ai/tech/agent-exchange-layer`
- API reference: `https://github.com/gensyn-ai/axl/blob/main/docs/api.md`
- Examples: `https://github.com/gensyn-ai/axl/blob/main/docs/examples.md`

---

## KeeperHub

### Status: docs gated (403 from anonymous)

User must sign up at `https://app.keeperhub.com/` to access full docs:
- MCP docs: `https://docs.keeperhub.com/ai-tools`
- API docs: `https://docs.keeperhub.com/api`
- CLI docs: `https://docs.keeperhub.com/cli`

### What we know publicly

- **Product:** Execution + reliability layer for on-chain agents
- **Interfaces:** MCP server (for Claude/MCP runtimes), REST API, CLI, plugin marketplace
- **Payment rails supported:** x402 (live), MPP (coming soon)
- **Agent framework integrations:** ElizaOS, OpenClaw, LangChain, CrewAI
- **Prize criteria emphasize depth of integration + docs quality over novelty**

### Plugin marketplace install (one route)

```bash
/plugin marketplace add KeeperHub/claude-plugins
/plugin install keeperhub@keeperhub-plugins
/keeperhub:login
```

### Integration plan for Scholar Swarm

1. Escrow: user-to-contract payment held before work starts
2. x402 per-agent: after each step completes, agent hits a KeeperHub-backed x402 endpoint to claim payment
3. PaymentRouter contract: single user payment → 5 agent payouts, reconciled via KeeperHub execution triggers
4. Retry: if individual agent tx fails (OOG etc.), KeeperHub retries
5. Audit: every payment + retry logged for READ from frontend

### Unblock next

- User signs up at app.keeperhub.com
- Access gated docs
- Share API key path + any example workflow JSON
- **Then** Spike 4 script can be written concretely

---

## x402 Protocol

### Packages

```bash
pnpm add @x402/axios @x402/evm
# @x402/svm if Solana support wanted (we don't need it)
pnpm add @modelcontextprotocol/sdk
```

### Payment flow

1. Server returns HTTP 402 + `PAYMENT-REQUIRED` header (base64 JSON with scheme, network, token, amount, recipient)
2. Client signs payment with scheme's sign fn
3. Client retries request with `PAYMENT-SIGNATURE` header
4. Server verifies + serves content

### Client wrapper example

```ts
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const x402 = new x402Client();
x402.register("eip155:*", new ExactEvmScheme(evmSigner));
const httpClient = wrapAxiosWithPayment(axios.create(), x402);
// httpClient handles 402 responses automatically
```

### Chains + tokens

- EVM: Base Sepolia, Base Mainnet, Ethereum — USDC
- We use: Base Sepolia (for hackathon demo)

---

## Tavily (Retrieval)

### Docs

- API: `https://docs.tavily.com`
- MCP server: `https://github.com/tavily-ai/tavily-mcp`
- Free tier: 1000 requests/month

### Use

For our architecture, easiest is:
- Researcher agent calls `tavily-search` MCP tool locally
- OR runs tavily-mcp as a separate process on one peer + routes via AXL `/mcp/{peer_id}/tavily-search` to demonstrate MCP-over-AXL

Spike 3 will decide which.

---

## 0G Compute — Real Model Catalog (verified Day 3)

Source: `docs/og-llms-full.txt` (full 0G docs archive, downloaded 2026-04-27).

### Testnet (Galileo) — 1 chatbot + 1 image-edit only
| Model | Type | Verification | Provider | Input / Output (per 1M tok) |
|---|---|---|---|---|
| `qwen-2.5-7b-instruct` | Chatbot | TeeML | `0xa48f01...` | 0.05 / 0.10 OG |
| `qwen-image-edit-2511` | Image-Edit | TeeML | `0x4b2a9...` | — / 0.005 OG/image |

**Implication:** on testnet we cannot do "Researcher = Model A, Critic = Model B" — only one chatbot exists. Strategy: same model + different system prompts + record both attestations. Mainnet (7 models) opens the dual-model path if budget allows.

### Mainnet (Aristotle) — 5 chatbots + speech + image
| Model | Verification | Input / Output (per 1M tok) | Notes |
|---|---|---|---|
| `gpt-oss-120b` | TeeML | **0.10 / 0.49 OG** | Cheapest, large open-source GPT — best Researcher/Critic candidate |
| `deepseek-chat-v3-0324` | TeeML | 0.30 / 1.00 OG | Optimized conversational |
| `qwen3-vl-30b-a3b-instruct` | TeeML | 0.49 / 0.49 OG | Text-only despite VL name |
| `GLM-5-FP8` | TeeML | 1.0 / 3.2 OG | High-perf reasoning |
| `qwen3.6-plus` | **TeeTLS** | 0.80 / 4.80 OG (1M ctx) | Agentic-coding optimized — best Synthesizer candidate |
| `whisper-large-v3` | TeeML | 0.05 / 0.11 OG | Speech-to-text |
| `z-image` | TeeML | — / 0.003 OG/image | Text-to-image |

> **Earlier dismissal of `qwen3.6-plus` / `GLM-5-FP8` as "made up" was wrong.** They are real, attested mainnet models. Apologies in `PLAN.md` change log.

### TeeML vs TeeTLS — what attestation actually proves

**TeeML** (Trusted Execution → Model Local): The model itself runs inside the TEE. Response is signed by the TEE's private key. **Strongest proof** — prove the named model, on the named hardware, produced this output. Used by self-hosted providers (`gpt-oss-120b`, `GLM-5-FP8`, `DeepSeek`).

**TeeTLS** (Trusted Execution → TLS proxy): The Broker runs in TEE and proxies to a centralized provider (e.g., Alibaba Cloud) over HTTPS. TEE captures the provider's TLS cert fingerprint + binds it to (request hash, response hash, provider identity) using TEE-protected key. **Slightly weaker** — proves request reached the real provider, not that the provider itself is honest. Used by `qwen3.6-plus`.

**Pitch implication:** lead with TeeML examples. "Our Researcher and Critic both run on TeeML — the inference itself is sealed, not the routing."

### 0G Testnet System Contracts (we INTERACT with these, do not deploy)

| Contract | Address (Galileo) | Purpose |
|---|---|---|
| Compute Ledger | `0xE70830508dAc0A97e6c087c75f402f9Be669E406` | SDK calls `depositFund` / `transferFund` here |
| Compute Inference | `0xa79F4c8311FF93C06b8CfB403690cc987c93F91E` | Service registry |
| Compute FineTuning | `0xaC66eBd174435c04F1449BBa08157a707B6fa7b1` | Fine-tune jobs |
| Storage Flow | `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` | Storage data flow |
| Storage Mine | `0x00A9E9604b0538e06b268Fb297Df333337f9593b` | Mining rewards |
| Storage Reward | `0xA97B57b4BdFEA2D0a25e535bd849ad4e6C440A69` | Reward distribution |
| DAEntrance | `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B` | DA blob submission |
| DASigners (precompile) | `0x0000000000000000000000000000000000001000` | DA signer mgmt |
| WrappedOGBase (precompile) | `0x0000000000000000000000000000000000001001` | wOG native |

### 0G Chain — Foundry deploy

EVM-compatible, full Solidity tooling. Foundry config:
```bash
forge create --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $DEMO_PLANNER_KEY \
  src/MyContract.sol:MyContract
```
Already wired in `foundry.toml` via `[rpc_endpoints] og_testnet`.

3rd-party RPCs (for reliability under load): QuickNode, ThirdWeb, Ankr, dRPC.

---

## iNFT — ERC-7857 Standard (NEW, in scope per Day 3 decision)

### Why
- 0G Swarms track requirement: *"For iNFTs: proof of embedded intelligence on 0G explorer."*
- Without iNFT, Swarms track ceiling drops to bottom of top-5 ($1.5k flat).
- With iNFT, top-3 contention possible.

### What ERC-7857 Adds Over ERC-721
- Encrypted metadata (the AI agent's "intelligence" is encrypted at rest)
- Secure re-encryption on transfer via TEE/ZKP oracles
- Cloning (`iCloneFrom`) — same intelligence, new token
- Authorize usage (`authorizeUsage` / `revokeAuthorization`) — grant use without ownership transfer (max 100 users per token, cleared on transfer)
- Data Storage (`ERC7857IDataStorageUpgradeable`) — on-chain `IntelligentData` arrays per token

### Reference Implementation (we fork this)
**Repo:** `https://github.com/0gfoundation/0g-agent-nft`

Key contracts in repo:
- `AgentNFT` — main minting + creator tracking + mint fees. Roles: `ADMIN_ROLE`, `OPERATOR_ROLE`, `MINTER_ROLE`
- `AgentMarket` — order/offer marketplace, EIP-712 signatures, platform + partner fee distribution, native + ERC20 payment
- `IERC7857`, `IERC7857Cloneable`, `IERC7857Authorize`, `ERC7857IDataStorageUpgradeable` — interfaces
- Uses upgradeable beacon proxies + OpenZeppelin AccessControl

### Scholar Swarm Use
- Each agent role (Planner, Researcher 1, Researcher 2, Critic, Synthesizer) is an iNFT
- Encrypted intelligence on 0G Storage = agent's system prompt + role spec + accumulated context. Hash committed to iNFT.
- Reputation accrues to the iNFT (not the operator wallet) — so reputation is transferable
- Demo: show `authorizeUsage` flow — Critic's owner authorizes the Synthesizer's owner to use Researcher 2 for one job

### Cost / Scope
- 1.5–2 days of work — fork ref impl, wire into our flow, mint 5 iNFTs in deploy script
- Day 7 buffer covers it. Or Day 4-5 stretch since contracts day.

---

## KeeperHub — Day 3 Auth & Chain Findings

### Token types
| Prefix | Scope | Endpoints unlocked |
|---|---|---|
| `wfb_` ← we have this | Workflow-bound | `/api/workflows` GET, webhook trigger |
| `kh_` ← required for execute | Full account | `/api/execute/transfer`, `/api/execute/contract-call`, `/api/execute/check-and-execute`, all read |

User must create `kh_` key in `app.keeperhub.com` → Settings → API Keys.

### Auth header
`Authorization: Bearer <key>` (some endpoints also accept `X-API-Key`). Verified.

### Chain support — definitive (verified Day 3 with funded KH wallet)
KH `/api/execute/transfer` accepts ONLY these network identifiers (returned verbatim by error message):
- `mainnet`, `eth-mainnet`, `ethereum-mainnet`, `ethereum`
- `sepolia`, `eth-sepolia`, `sepolia-testnet`
- `base`, `base-mainnet`
- **`base-sepolia`, `base-testnet`** ← our target
- `tempo-testnet`, `tempo`, `tempo-mainnet`
- `solana`, `solana-mainnet`, `solana-devnet`, `solana-testnet`
- "or numeric chain IDs" (must be in `/api/chains` registry)

**0G chain rejection — definitive:**
- `network: "0g"` → `"Unsupported network: 0g"`
- `network: "0g-galileo"` → `"Unsupported network: 0g-galileo"`
- `network: "16602"` → `"Chain 16602 not found or not enabled"`

**Note:** `ethereum-sepolia` is NOT accepted — use `sepolia` or `eth-sepolia`.

This is the **forcing function** for our chain-split architecture: PaymentRouter MUST be on a KH-supported chain (Base Sepolia for hackathon — it has USDC, x402, lower gas).

### KH Para wallet (Organization Wallet)
- Address: `0x7109C8e3B56C0A94729F3f538105b6916EF59348` (created Day 3)
- Across all EVM testnets (same address)
- Uses MPC: private key split between user and Para; export via dashboard available
- For our pitch: KH wallet pays gas + signs `PaymentRouter.distribute()` calls. Our agents have separate EOAs as identities.
- Funding need: ~0.01 Base Sepolia ETH for gas-only test runs.

### Direct Execution API — the crown jewel
`POST /api/execute/contract-call` — KH calls any contract on supported chain with auto retry, nonce mgmt, gas estimation, audit log. This is what we trigger from our agent code (or via KH workflow watching events).

```json
{
  "contractAddress": "0x...",
  "network": "base-sepolia",
  "functionName": "distributeBatch",
  "functionArgs": "[\"0x...\", [\"0x...\", \"0x...\"], [\"100\", \"50\"]]",
  "abi": "[{...}]",
  "gasLimitMultiplier": "1.2"
}
```

Returns: `pending | running | completed | failed`. Status checkable via `/api/execute/status/{id}`.

### Hosted MCP Server
URL: `https://app.keeperhub.com/mcp`. Auth: OAuth or `kh_` API key. Tools available include:
`list_workflows, get_workflow, create_workflow, update_workflow, delete_workflow, execute_workflow, get_execution_status, get_execution_logs, ai_generate_workflow, list_action_schemas, list_integrations, get_wallet_integration, search_plugins, search_templates, deploy_template`.

**Killer demo angle:** Planner agent uses `ai_generate_workflow` MCP tool to create the payout workflow on demand, then `execute_workflow` triggers it.

### Para Wallet (avoid for narrative)
KH default user wallet is Para MPC custodial. We'd lose "different operators" pitch if all 5 agents share one Para wallet. **Solution: agents use their own EOAs**, KH = trigger/reliability layer (Direct Execution API → our PaymentRouter contract).

---

## Change log

- **2026-04-27 (Day 3):** Real model catalog confirmed (testnet 1 / mainnet 7). TeeML vs TeeTLS distinction documented. iNFT/ERC-7857 added to scope. KH `kh_` vs `wfb_` token types clarified. KH chain registry verified — no 0G, forces hybrid architecture. Compute Ledger + Inference contract addresses captured. 0G `llms-full.txt` archived locally.
- **2026-04-25 (Day 1):** Initial research pass. 0G Compute + Storage SDKs documented; AXL architecture + API from public sources; KeeperHub partly gated; x402 clear.
