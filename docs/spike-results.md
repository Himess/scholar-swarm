# Day 0 Spike Results

> One row per spike. Log outcome, decisions, and any architecture impact.
> Update `PLAN.md` §4 (Open Decisions) as these close.

| # | Spike | Status | Outcome | Decision / Impact |
|---|---|---|---|---|
| 1 | 0G Compute inference | 🟡 partial | Catalog confirmed; inference deferred (need ≥5 OG) | Use indexed tuple access; SDK 0.7.5; TeeML via dstack |
| 2a | AXL local mesh | ⏳ pending | — | — |
| 2b | AXL cross-ISP mesh | ⏳ pending | — | — |
| 3 | MCP over AXL | ⏳ pending | — | AXL pitch Plan A/B trigger |
| 4 | KeeperHub x402 payment | 🟡 partial | Auth + network validation + execution tracking confirmed; tx fail due to 0 ETH gas | Network=`base-sepolia`; KH wallet `0x7109...934B` needs ~0.01 Base ETH |
| 5 | 0G Storage read-write | ⏳ pending | — | — |
| 7 | ERC-8004 + ERC-7857 spec | ✅ pass | Spec read; inheritance plan in `spike-07-erc8004-erc7857.md` | `AgentNFT` unifies ERC-7857 + ERC-8004 IdentityRegistry; separate `ReputationRegistry`; ValidationRegistry skipped |

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
- [ ] One inference call returns text — **deferred** (insufficient OG balance, need ≥5)
- [ ] Attestation blob captured + parsable — pending inference
- [ ] Tool use / function calling supported — pending inference
- [ ] Latency + cost recorded — pending inference

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
- **O2 (tool use) → DEFERRED:** Cannot test without funding. Mitigation: write code paths that work BOTH if tool-use supported and if not (researcher does retrieval externally then feeds context).
- **Funding action:** Need 5 OG total. Faucet 0.1/day = 50 days. **Discord ask is critical path.** Or use 5 wallets faucet'd in parallel + transfer to one.

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

**Run:** _TBD_

### Checklist
- [ ] Laptop node running (TR ISP, NAT)
- [ ] Hetzner node running (public IP)
- [ ] Peer discovery Laptop → Hetzner
- [ ] Peer discovery Hetzner → Laptop (NAT traversal)
- [ ] Message RTT recorded

### Findings
_TBD — if NAT traversal fails, trigger §3.5 fallback (2nd VPS)_

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
