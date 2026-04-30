# @scholar-swarm/sdk

**A swarm-first agent framework in the OpenClaw family, built natively for 0G.**

OpenClaw scales **one agent across many channels** (Telegram, Slack, Discord, …) with a config-first SOUL.md / TOOLS.md layout. Scholar Swarm SDK scales **N specialized agents through one coordinated workflow** with a code-first Role + provider layout. Same family, different axis.

If OpenClaw answers *"how does my single AI assistant reach me everywhere?"*, Scholar Swarm SDK answers *"how do four specialist agents — running on different machines, owned by different operators — collaborate trustlessly on a single goal?"*

---

## Position in the agent-framework landscape

| | **OpenClaw** | **Scholar Swarm SDK** |
|---|---|---|
| **Topology** | 1 agent ⇄ N channels | N agents ⇄ 1 workflow |
| **Config surface** | Config-first (`SOUL.md`, `TOOLS.md`, `SKILL.md`) | Code-first (`Role` subclass + provider injection) |
| **Identity model** | Local user wallet | Per-agent on-chain identity (ERC-7857 iNFT + ERC-8004) |
| **Coordination** | Local Gateway (in-process router) | P2P mesh (AXL) — different operators, different machines |
| **Memory** | Filesystem, cloud sync | 0G Storage (KV + log + blob) |
| **Inference** | Pluggable provider, often centralized | 0G Compute sealed inference (TeeML / TeeTLS) |
| **Trust model** | Trust the operator | Cryptographic attestation per inference call + on-chain reputation |
| **Best for** | Personal assistants, prosumer chatbots | Multi-party agentic workflows where outputs are paid for |

The two are **complementary, not competitive** — you can imagine an OpenClaw user invoking a Scholar Swarm SDK agent through a Telegram channel as one of their tools.

---

## Why a separate framework

ETHGlobal Open Agents (April 2026) made it explicit: *"new open agent frameworks inspired by OpenClaw (or alternatives like ZeroClaw, NullClaw, etc.) and deployed on 0G."* Scholar Swarm SDK is one such alternative, focused on a corner OpenClaw doesn't cover: **trustless multi-agent specialization with verifiable outputs and on-chain payouts.**

Concretely:
- OpenClaw assumes a single trusted operator. Scholar Swarm SDK is built so every agent can be operated by a different person on a different machine and still produce a verifiable joint output.
- OpenClaw plugs into many channels. Scholar Swarm SDK plugs into many *providers* — swap the inference layer (TEE / open-weights / centralized) without changing role code, swap the messaging layer (AXL / libp2p / WebSocket) the same way.

---

## Core primitives

```
┌─────────────────────────────────────────────────────┐
│  Role (abstract)                                     │
│    └─ handle(SwarmMessage) — react to inbound msgs  │
│    └─ tick() — periodic background work             │
└──────────────────┬──────────────────────────────────┘
                   │ bound to
                   ▼
┌─────────────────────────────────────────────────────┐
│  RoleContext                                         │
│    agentId, operatorWallet, providers, log          │
└──────────────────┬──────────────────────────────────┘
                   │ owns
                   ▼
┌─────────────────────────────────────────────────────┐
│  AgentProviders                                      │
│    InferenceProvider  ← attested LLM (0G Compute)    │
│    StorageProvider    ← decentralized blob/KV (0G)   │
│    MessagingProvider  ← P2P mesh (AXL)               │
│    PaymentProvider    ← payout rail (KeeperHub)      │
│    RetrievalProvider  ← web search (SearXNG / Tavily)│
│    ReputationProvider ← ERC-8004                     │
└─────────────────────────────────────────────────────┘
                   │ wired into
                   ▼
┌─────────────────────────────────────────────────────┐
│  Agent — runtime that subscribes/dispatches/ticks   │
└─────────────────────────────────────────────────────┘
```

Every primitive is replaceable. The reference implementation uses 0G + AXL + KeeperHub + Tavily but the SDK ships zero hard dependencies on those packages — only on their interfaces.

---

## Five-minute example

```ts
import { Agent, Role } from "@scholar-swarm/sdk";
import { OGComputeInferenceProvider, OGStorageProvider } from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

class GreeterRole extends Role {
  readonly id = "greeter";

  async handle(msg, sender) {
    if (msg.kind !== "bounty.broadcast") return;
    const greeting = await this.ctx.providers.inference.infer({
      messages: [
        { role: "system", content: "Greet the bounty in one cheerful line." },
        { role: "user", content: msg.bounty.goal },
      ],
    });
    this.log(`greeting: ${greeting.content}`);
  }
}

const inference = await OGComputeInferenceProvider.create({ privateKey: process.env.PK! });
const storage   = new OGStorageProvider({ privateKey: process.env.PK! });
const messaging = new AXLMessagingProvider({ peerId: process.env.PEER_ID! });

const agent = new Agent({
  agentId: "1",
  operatorWallet: "0xF505…",
  providers: { inference, storage, messaging },
  role: new GreeterRole(),
});
await agent.start();
```

That's all. Subscribe. Handle. Done.

---

## The reference swarm — Scholar Swarm

The canonical example built on this SDK is `@scholar-swarm/agent-planner` + `@scholar-swarm/agent-researcher` + `@scholar-swarm/agent-critic` + `@scholar-swarm/agent-synthesizer`.

The Planner decomposes a research goal into 3 sub-tasks, two Researchers compete on bids, the Critic verifies every claim against fetched sources, the Synthesizer produces a final report — all coordinated over AXL, all attested through 0G Compute, all payable through KeeperHub Direct Execution.

See `apps/agent-*` in the repo for the four roles, and `contracts/src` for the on-chain backing (ERC-7857 + ERC-8004 unified `AgentNFT`, plus `Bounty`, `BountyFactory`, `ReputationRegistry`, `ArtifactRegistry`, `PaymentRouter`).

---

## How to extend

### Build your own role
Subclass `Role`, implement `handle(msg, sender)`, optionally `tick()`. Bind a provider stack, hand it to `Agent`, call `start()`. The SDK runs the inbox loop and the ticker for you.

### Swap a provider
Implement the relevant interface from `./providers.js` and pass an instance into `Agent.providers`. No role code changes. We use this internally to write Foundry tests against mock providers and run live demos against 0G + AXL + KeeperHub.

### Define a new message type
Add a discriminated case to the `SwarmMessage` union in `./types.js`. All roles get it for free; ones that don't `handle()` it just ignore.

---

## What this SDK is *not*

- **Not a no-code builder.** OpenClaw's SOUL.md / WebChat / visual surface is more accessible. Use it for prosumer assistants. Scholar Swarm SDK is for builders who want raw composition.
- **Not chain-coupled by interface.** The SDK contracts don't import any blockchain library. Adapters do. You can run the SDK on a single laptop with no chain at all and the agents still talk over AXL.
- **Not a replacement for retrieval, embedding, or fine-tuning frameworks.** It's an orchestration layer. Plug LangChain or DSPy *inside* a Role if you want.

---

## License

MIT. Same as OpenClaw, same as the rest of Scholar Swarm.

## Status

Initial release shipped during ETHGlobal Open Agents 2026. Reference Scholar Swarm deployment lives on 0G Galileo + Base Sepolia — see [`docs/deployment.md`](../../docs/deployment.md) for contract addresses and explorer links. **20 / 20 integration spikes PASS** including multi-process choreography (5 AXL nodes coordinating one bounty end-to-end), real Circle USDC distribution via KeeperHub, and SearXNG retrieval over MCP-over-AXL — full breakdown in [`docs/spike-results.md`](../../docs/spike-results.md).
