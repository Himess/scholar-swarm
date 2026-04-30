# Sponsor track positioning — Scholar Swarm

This file is the **per-track pitch** for each sponsor we're submitting against. Each section is what we'd say to the track's reviewers in 60 seconds: why this project belongs in this track, and which on-chain artifact backs the claim.

The structure mirrors how ETHGlobal track judges typically read submissions — they don't have time to absorb the whole README, they want a fast read on whether the project is a serious fit for *their* track.

---

## 0G Labs · dual track (Best Agent Framework + Best Autonomous Agents / Swarms / iNFTs)

**Why we're submitting in both tracks:** Scholar Swarm is structurally one project with two distinct deliverables — an SDK that other teams could fork (Framework) and a working multi-agent application that uses 0G's unique primitives (Autonomous Agents / iNFTs). The two tracks are evaluated against different criteria, but the proof for both lives in the same repo.

### Best Agent Framework — `@scholar-swarm/sdk`

A **swarm-first agent framework in the OpenClaw family**. The differentiation vs. OpenClaw is topology: OpenClaw is *one agent across many channels*; the Scholar Swarm SDK is *N agents coordinating on one workflow*. Both are valid agent shapes, but they serve different problems — and "many specialists collaborating on one job" is not what existing single-agent frameworks are optimized for.

What the SDK gives you:
- Code-first `Role` + `Provider` model — every component is a TypeScript interface with concrete adapters (`OGComputeProvider`, `OGStorageProvider`, `AXLMessagingProvider`, `KeeperHubPaymentProvider`, `RetrievalProvider` with both Tavily and SearXNG impls)
- Per-agent on-chain identity baked in: every Role is bound to an ERC-7857 iNFT + ERC-8004 reputation registration, signing its own on-chain actions
- Coordination primitives that don't require a central broker — AXL P2P mesh underneath, MCP-over-AXL for peer-hosted tools
- MIT licensed, domain-agnostic. Scholar Swarm is *one* application — judges could imagine the same SDK running a code-review swarm, a legal-analysis swarm, an investigative-journalism swarm

**Proof:** [`packages/swarm-sdk/README.md`](../packages/swarm-sdk/README.md) for the primitive list. [`apps/agent-{planner,researcher,critic,synthesizer}/`](../apps/) shows four distinct Role implementations all running against the same `Provider` interfaces.

### Best Autonomous Agents / Swarms / iNFTs — Scholar Swarm itself

This is the iNFT track that 0G is funding hardest, and the one where the on-chain artifact tells the whole story.

- **Five iNFTs minted on 0G Galileo** at `AgentNFT` [`0x68c0…5361`](https://chainscan-galileo.0g.ai/address/0x68c0175e9d9C6d39fC2278165C3Db93d484a5361). Each holds AES-256-GCM encrypted role definition + system prompt; merkle root committed in `iNFT.intelligenceRoot`. Mint artifact: [`docs/spike-artifacts/minted-agents.json`](./spike-artifacts/minted-agents.json).
- **Five distinct operator wallets** sign on-chain actions. The "different operators" claim is verifiable — bounty 20 has 16 chain txs from 5 distinct signers. Frontend gallery: [scholar-swarm.vercel.app/agents](https://scholar-swarm.vercel.app/agents).
- **Pay-to-authorize royalty live** — `AgentRoyaltyVault` enforces a 95/5 owner/creator split per ERC-2981. Spike 10 paid 0.002 OG into the vault and observed the exact split on-chain.
- **TEE-attested inference on every call** — every Role's LLM step runs through 0G Compute on `qwen2.5-7b-instruct` (TeeML / dstack). The signed attestation is replayable by any third party. Spike 1 verified.
- **Encrypted Critic rationale on 0G Storage** — for every claim the Critic checks, a JSON blob `{claimIndex, sourceFetchedOk, semanticMatch, notes}` is written to 0G Storage and the resulting `reasonURI` committed in `ClaimReviewed`. Anyone holding the URI can fetch and reconstruct *exactly why* the Critic voted as it did.

All three primitives — iNFT minting, 0G Compute attestation, and per-claim rationale on 0G Storage — are used the way the 0G stack was designed to be used: not as a single integration point, but as the substrate the entire swarm runs on.

**One-click verification:** [Verifiable on-chain artifacts table](../README.md#verifiable-on-chain-artifacts) in the main README.

---

## Gensyn AXL · Best Application of AXL

The judging criterion here is whether AXL is doing real architectural work — not whether it appears in a `package.json`. For Scholar Swarm, removing AXL would force a centralized message broker, which would directly contradict the "trustless multi-agent" claim. AXL is **load-bearing**.

What we did with AXL specifically:

- **Five-node Yggdrasil mesh, cross-ISP verified.** Spike 2a got two local nodes talking; Spike 2b extended to a TR residential laptop ↔ EU VPS bidirectional round-trip with both peers in the spanning tree. Setup procedure: [`docs/axl-vps-setup.md`](./axl-vps-setup.md). This is the substrate the swarm coordinates on.
- **MCP-over-AXL pattern.** `POST /mcp/{peer_id}/{service}` lets one Researcher's locally-hosted retrieval (SearXNG container) serve every other agent through the mesh, with no central tool host. Spike 3 PASS. This is the agent-to-tool coordination story AXL was designed for.
- **`@scholar-swarm/axl-client`** — a typed `AXLMessagingProvider` wrapping the local AXL HTTP API at `:9002`. Drop-in for any project using the swarm-sdk's provider interfaces.
- **Continuously deployed live.** Five `scholar-axl-{planner,r1,r2,critic,synth}.service` systemd units run on an EU VPS with `Restart=always`. A cron at `/etc/cron.d/scholar-swarm` fires `pnpm spike:18:cli` every six hours; the most recent successful run is in [`docs/vps-runs/latest.json`](./vps-runs/latest.json), surfaced as a pulsing "Live VPS swarm" badge on [scholar-swarm.vercel.app](https://scholar-swarm.vercel.app).

The architectural point: in Scholar Swarm, AXL replaces the message broker that every "multi-agent" project tends to drift into. No Redis pub/sub, no centralized event bus, no hosted orchestrator service. Each agent has an ed25519 peer identity and signs its own messages.

**Proof:** [Spike 2b PASS](./spike-results.md), [Bounty 20 multi-process choreography](https://chainscan-galileo.0g.ai/address/0xebdf9FBAcb3172d2441FB7E067EFAB143F7F4eD8) — 16 chain txs from 5 distinct AXL-coordinated processes.

---

## KeeperHub · Best Use of KeeperHub + Builder Feedback Bonus

KH is what closes the cross-chain loop that the rest of the stack can't. 0G has no KH support (verified: API returns `"Unsupported network: 0g"`), so we deliberately split: **LayerZero V2 proves the message, KeeperHub ensures the resulting Base-side tx lands.** Each layer does what it's best at.

### Best Use of KeeperHub

We integrate KH on **three distinct surfaces**, each load-bearing:

1. **Hosted MCP server** at `https://app.keeperhub.com/mcp` — 26 tools live (`list_workflows`, `execute_workflow`, `ai_generate_workflow`, `create_workflow`, `get_execution_logs`, `execute_contract_call`, `search_protocol_actions` …). Spike 8 enumerated the full tool list over Streamable HTTP.
2. **Live workflow on the org** — drafted via `ai_generate_workflow` (Spike 13), persisted via `create_workflow` (Spike 14). Workflow id [`nepsavmovlyko0luy3rpi`](https://app.keeperhub.com/workflows/nepsavmovlyko0luy3rpi). Trigger: `DistributeRequested` event on `PaymentMessenger`. Action: `PaymentRouter.distribute(bountyKey, recipients[], amounts[])`.
3. **REST Direct Execution API** — hot path for the `distribute()` call. KH's Para wallet (whitelisted as `keeper` on `PaymentRouter`) signs the tx; we never hold the key.

**The end-to-end proof:** Spike 19 — **1.000000 Circle USDC moved across 5 distinct operator wallets on Base in ~0.7 seconds**, KH-signed. Distribute tx [`0xa06717e4…`](https://sepolia.basescan.org/tx/0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7). That single transaction is the cleanest one-line argument for "KH did real work here": gas estimation, retry handling, full audit log — all by KH, all per the Bounty contract's fee schedule.

`@scholar-swarm/keeperhub-client` ships both surfaces (`KeeperHubPaymentProvider` for REST, `KeeperHubMCPClient` for Streamable HTTP). The split is intentional — REST is right for hot-path single-tx execution, MCP is right for workflow management.

### Builder Feedback Bonus

We hit real friction during integration and documented it in [`FEEDBACK.md`](../FEEDBACK.md). Six concrete items:

- `wfb_` vs `kh_` token type distinction was undocumented at API level
- `/api/chains` shows 20 chains; FAQ claims 6. Mismatch unreconciled
- `network: ethereum-sepolia` is rejected; canonical is `sepolia` or `eth-sepolia` — not in Direct Execution docs
- Status URL is `/api/execute/{id}/status` (suffix), not `/api/execute/status/{id}` (prefix) as one might guess
- `network: 0g` returns `Unsupported`, but `/api/integrations/0g` returns 401 — suggests an integration scaffold without an active backend
- `docs.keeperhub.com` blocks anonymous browsers (User-Agent filter), making AI-tooling research harder

Plus 4 feature requests and 3 v2 plans. We hit each of these during real builds (Spikes 4, 8, 13, 14, 19) so the feedback is grounded, not speculative.

**Proof:** [`FEEDBACK.md`](../FEEDBACK.md) at the repo root, plus the live workflow [`nepsavmovlyko0luy3rpi`](https://app.keeperhub.com/workflows/nepsavmovlyko0luy3rpi) on our KH org.
