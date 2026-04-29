# KeeperHub — Builder Feedback

Honest, actionable feedback from integrating KeeperHub into Scholar Swarm
([github.com/Himess/scholar-swarm](https://github.com/Himess/scholar-swarm))
during ETHGlobal Open Agents 2026. Submitted for the **$250 KH Builder
Feedback Bounty**.

**Submitter:** Semih Civelek · [@Himess__](https://twitter.com/Himess__) · [@SemihCivelek on Telegram](https://t.me/SemihCivelek) · semihcvlk53@gmail.com
**Project:** Scholar Swarm — multi-agent research swarm with KH-signed cross-chain USDC payouts
**Integration depth:** MCP server + Direct Execution REST + live workflow `nepsavmovlyko0luy3rpi`
**Live evidence:** distribute tx [`0xa06717e4…f0b7`](https://sepolia.basescan.org/tx/0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7) — KH Para wallet signed `PaymentRouter.distribute()` after our `POST /execute/contract-call`, **0.7 seconds trigger-to-confirm**

---

## What worked great

- **Direct Execution REST shape is clean.** `POST /api/execute/contract-call` with bearer token, `contractAddress + network + functionName + functionArgs(JSON-encoded) + abi(JSON-encoded)` is straightforward. The response includes `transactionHash` and `transactionLink` directly — for simple cases no polling needed.
- **0.7-second latency surprised us.** We expected 2–5 s based on common keeper UX. Submitting the request to seeing the on-chain confirmation took under one second consistently across our test runs.
- **MCP server connected first try** with `@modelcontextprotocol/sdk@^1.18` over Streamable HTTP. Auth header `Authorization: Bearer kh_…` worked exactly as the docs implied.
- **`ai_generate_workflow` + `create_workflow` together saved real time.** We described our event→action wiring in plain English, got back well-shaped operations, and persisted the workflow programmatically. Workflow id `nepsavmovlyko0luy3rpi` showed up on the org dashboard immediately.
- **Visual graph view + audit trail.** Trigger node → action node visualization made debugging obvious. Per-execution audit log tells you exactly what KH did.
- **24 / 26 listed MCP tools** covered everything we needed. Felt comprehensive.

---

## Documentation gaps that slowed us down

### 1. Direct Execution discoverability
**Friction:** We found `/api/execute/contract-call` only after digging into our own KH client code. The MCP path is well-documented; the REST hot-path is not.

**What would have saved a day:** A "Trigger an action without a workflow" page in the docs, with the exact `POST /execute/contract-call` payload shape including the JSON-encoded `functionArgs` and `abi` fields. Currently builders have to reverse-engineer it from API docs that don't lead with this use case.

---

### 2. `wfb_` vs `kh_` token type distinction
**Friction:** Two API key prefixes show up in different places (`kh_…` for full account, `wfb_…` for workflow-scoped) but the docs don't explain the distinction at the API level.

**What would help:** A short "API key types" section in the docs covering scope, where each is generated, and which endpoints accept which.

---

### 3. Status URL path order
**Friction:** Status endpoint is `/api/execute/{id}/status` (suffix). On first read we tried `/api/execute/status/{id}` (prefix) — felt more conventional.

**Easy fix:** Make the URL pattern explicit in the response of `POST /execute/contract-call` itself, e.g. include `statusUrl` in the response body so builders don't have to guess.

---

### 4. Network identifier inconsistency
**Friction:** `/api/chains` endpoint shows 20 chains; the public FAQ claims 6. The mismatch went unreconciled when we tried `network: 0g` (returned `Unsupported`) but `/api/integrations/0g` returned 401 — suggesting an integration scaffold without an active backend.

Also: `network: ethereum-sepolia` is rejected; canonical is `sepolia` or `eth-sepolia` — not documented in the Direct Execution doc page.

**What would help:** A canonical network-identifier table in the Direct Execution doc, and reconciling the FAQ vs API-listed chains.

---

### 5. Workflow templating: `bytes32` derivations from event params
**Friction:** Building our workflow definition, we needed `bountyKey = keccak256(bountyId)` derived from a `uint256 bountyId` event param. Wrote it as `{{keccak256('bountyId')}}` and `{{keccak256(bountyId)}}` in different attempts — wasn't sure which referred to the literal string vs the runtime value.

**Concrete suggestion:** A docs page or in-tool example showing common `bytes32` derivations from event parameters (keccak hash, abi.encodePacked, padded). These are *very* common in production workflows.

---

### 6. MCP `execute_workflow` vs Direct Execution boundary
**Friction:** We tried MCP `execute_workflow` first (because it was listed in the MCP tool catalog) and got back content we couldn't act on directly. The split — MCP for **managing** workflows, REST for **triggering** ad-hoc actions — is the right split, but the boundary isn't called out anywhere.

**What would help:** A one-paragraph orientation in the MCP server docs that says "Use MCP for workflow CRUD + observability; use Direct Execution REST for hot-path action triggers."

---

### 7. `docs.keeperhub.com` User-Agent filter blocks AI tooling research
**Friction:** When we used WebFetch / curl from CLI tools to research the API, `docs.keeperhub.com` returned 403 / blank for non-browser User-Agents.

**Suggestion:** Either relax the filter for safe crawlers, or expose a static `docs.keeperhub.com/llms.txt` (à la Anthropic / Vercel) that AI agents and code-aware tools can read. As the AI-tooling-builders' market grows, this matters more.

---

## Feature requests

### A. Built-in event-to-action templating helper

Right now KH workflows can derive simple values from event parameters, but for `bytes32` derivations, padding, and ABI-encoding scenarios, builders write workarounds. A small helper UI or doc page for this would lift a lot of friction.

### B. Multi-step workflows across chains

Our use case (Bounty completes on 0G → LZ message lands on Base → KH triggers payout) needed two separate concerns: the cross-chain message (LZ V2) and the on-chain action (KH). It would be nice to express this as a single multi-chain KH workflow: trigger on chain A, monitor chain B for a derived event, fire action on chain C. We worked around this by deploying our own LZ V2 OApp on Base that emits the event KH listens for — fine, but a turnkey "cross-chain workflow" template would be the natural KH shape.

### C. EVM event → contract call template gallery

The Bounty.sol → PaymentRouter.distribute pattern is generic — many agent-economy projects will want this exact shape. A first-class template (parameterized by event name, action contract, value-derivation function) would let builders skip the manual JSON wrangling.

### D. Workflow simulator / dry-run

Before persisting a workflow to the org with `create_workflow`, we'd love a `simulate_workflow` MCP tool: takes the same operations array, returns a per-step "what would happen" trace with simulated event payloads. We hit a few false starts where workflow definitions looked correct but didn't match the runtime event shape; a dry-run would have caught these in seconds.

---

## What we'd build next *with* KeeperHub

1. **Reverse-direction bounty funding** — Base USDC fund → 0G bounty bind, mirror of our current 0G→Base flow. Same KH workflow shape, dual-direction LZ V2.
2. **Multi-keeper redundancy** — for production, no single signing key. Curious how KH thinks about this internally.
3. **Scholar Swarm SDK as a default-keeper template** — the `@scholar-swarm/sdk` is built so agent roles + payment providers are swappable. KH could ship as the default `PaymentProvider` template, letting any swarm (research, code-review, legal, journalism) inherit the same on-chain payout pattern we built.

---

## Summary

KeeperHub did its job — under a second from REST trigger to on-chain confirm, a clean MCP surface for setup-time work, a visible workflow on the org dashboard. The friction was almost entirely in **discoverability and docs**, not the platform itself. Closing those doc gaps would meaningfully shorten the path for builders who are integrating KH for the first time under hackathon time pressure.

Happy to elaborate on any item via DM ([@Himess__](https://twitter.com/Himess__) on X or [@SemihCivelek on Telegram](https://t.me/SemihCivelek)).
