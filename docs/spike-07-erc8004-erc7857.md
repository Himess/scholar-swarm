# Spike 7 — ERC-8004 + ERC-7857 spec research & inheritance plan

> Spec analysis. No on-chain runs needed for this spike — it's a design output.
> Result feeds directly into `contracts/src/` interfaces.

**Status:** ✅ COMPLETE (2026-04-27)

---

## 1. ERC-8004 — Trustless Agents (live on Ethereum mainnet 2026-01-29)

Three registries, each independent contract:

| Registry | Purpose | Mandatory? |
|---|---|---|
| **IdentityRegistry** | ERC-721-based agent IDs + URI + metadata + agent wallet binding | Yes |
| **ReputationRegistry** | Bounded feedback scores, tags, off-chain report URI + hash | Yes |
| **ValidationRegistry** | Optional re-execution / zkML / TEE proofs | **Skip MVP** |

### Key data model

- `agentId` is a `uint256` (ERC-721 token id)
- Feedback `value` is `int128` with `valueDecimals` (e.g., `(85, 2)` = 0.85)
- Tags: `tag1` indexed, `tag2` non-indexed — for filtering ("research-quality", "deepseek-source-validity", etc.)
- `feedbackURI` + `feedbackHash` (keccak256) — off-chain detailed report

---

## 2. ERC-7857 — Intelligent NFTs (iNFT)

Source: 0G Foundation reference impl at `github.com/0gfoundation/0g-agent-nft`.

| Interface | Purpose | We use? |
|---|---|---|
| **IERC7857** | Core: mint/transfer with encrypted metadata, oracle re-encryption | Yes |
| **IERC7857Metadata** | Metadata key/value access | Yes |
| **IERC7857Cloneable** | `iCloneFrom` — copy intelligence to new token | **Skip MVP** |
| **IERC7857Authorize** | `authorizeUsage` / `revokeAuthorization` (max 100 users) | **Yes (demo highlight)** |
| **ERC7857IDataStorageUpgradeable** | On-chain `IntelligentData` arrays per token | **Skip MVP** (use 0G Storage directly) |

### Reference impl in `0g-agent-nft`
- `AgentNFT.sol` — main minting + creator tracking + mint fees, AccessControl roles
- `AgentMarket.sol` — order/offer marketplace with EIP-712 signatures, native + ERC-20 payment
- Uses upgradeable beacon proxies (we will downgrade to non-upgradeable for hackathon — saves ~200 lines and one storage layout pitfall)

---

## 3. Combination — `AgentNFT` implements BOTH 7857 + 8004 IdentityRegistry

Both standards extend ERC-721. We unify them in one contract:

```solidity
contract AgentNFT is
    ERC721,                      // base
    IIdentityRegistry,           // ERC-8004 identity
    IERC7857,                    // ERC-7857 iNFT core
    IERC7857Metadata,            // ERC-7857 metadata access
    IERC7857Authorize,           // ERC-7857 usage authorization
    AccessControl
{
    // ERC-8004 metadata storage
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // ERC-7857 encrypted intelligence reference (0G Storage hash)
    mapping(uint256 => bytes32) private _intelligenceRoot;
    mapping(uint256 => bytes) private _encryptedKey;  // re-encryption envelope

    // ERC-7857 authorization registry
    mapping(uint256 => address[]) private _authorizedUsers;
    uint256 constant MAX_AUTHORIZED = 100;

    // ERC-8004 agent wallet binding (separate from ownership)
    mapping(uint256 => address) private _agentWallets;

    // ... functions implementing all three interfaces
}
```

**Why unify:** lower deploy cost, atomic state changes (e.g., transfer triggers re-encryption *and* authorization clear in one tx), simpler integration for the SDK (one address for all agent ops).

**Why NOT add ReputationRegistry to the same contract:** it has different access patterns — feedback is mutable, indexed by `(agentId, clientAddress, feedbackIndex)`, and large reads (`readAllFeedback`). Different storage layout, separate contract.

---

## 4. Final 0G Chain contract layout

| Contract | Implements | Notes |
|---|---|---|
| **AgentNFT** | ERC-721 + ERC-7857 (core, metadata, authorize) + ERC-8004 IIdentityRegistry | One contract for all agent-as-NFT semantics |
| **ReputationRegistry** | ERC-8004 IReputationRegistry | References AgentNFT for `agentId` validity |
| **AgentMarket** | (custom) | Fork of `0g-agent-nft/AgentMarket` — for "agent-for-sale" demo. Optional, can defer to Day 6 if time tight |
| **BountyFactory** | (custom) | Creates Bounty contracts per research job |
| **Bounty** | (custom) | Job lifecycle, sub-tasks, claims, approvals, mirror of Base PaymentRouter state |
| **ArtifactRegistry** | (custom) | Emits 0G Storage hash anchors per completed sub-task and final report |

### What we EXPLICITLY skip
- ❌ ValidationRegistry (ERC-8004) — Critic role substitutes; revisit in v2
- ❌ ERC-7857 Cloneable — agents not duplicable in MVP
- ❌ ERC-7857 IDataStorage — we put intelligence on 0G Storage, not on-chain arrays
- ❌ Upgradeable beacon proxies — hackathon non-upgradeable is fine; saves complexity

---

## 5. ERC-8004 fork strategy

Two reference implementations available:
- **Official:** `github.com/erc-8004/erc-8004-contracts` (canonical contracts)
- **Curated list:** `github.com/sudeepb02/awesome-erc8004` (for finding tested forks)

**Plan:** Fork the official `erc-8004-contracts` repo for `IdentityRegistry` and `ReputationRegistry` interfaces + reference impls. Then merge ERC-7857 features into the IdentityRegistry impl to produce our `AgentNFT`. Day 4 work.

---

## 6. Reputation scoring scheme (Scholar Swarm specific)

### Tag taxonomy (deterministic — no free-form to keep aggregation clean)
- `tag1`: role being rated → `"researcher"`, `"critic"`, `"synthesizer"`, `"planner"`
- `tag2`: dimension → `"approval-rate"`, `"source-quality"`, `"latency"`, `"final-rating"`

### Who gives feedback to whom
- **Critic → Researcher:** every approve/reject is a feedback event with `(agentId=researcher_iNFT_id, value=1 or 0, tag1="researcher", tag2="approval-rate")`
- **Bounty creator (user) → Synthesizer:** post-job rating 0..5 stars → `(value=stars*20, valueDecimals=0)` for 0-100 scale, `tag1="synthesizer"`, `tag2="final-rating"`
- **Planner → Researchers:** at bid-acceptance time, optional weight signal (skip MVP)
- **System → Critic:** if a critic-rejected claim later wins on retry, that's a positive critic feedback (Critic correctly caught a weak claim) → `tag2="catch-rate"`

### Demo seed reputations (pre-populated for video credibility)
Per PLAN.md §3.4 — seeded via deploy script:
- Researcher 1: 12 prior `tag1=researcher,tag2=approval-rate` feedbacks, average 0.83
- Researcher 2: 4 priors, average 0.95
- Critic: 20 priors, `tag2=catch-rate` average 0.88
- Synthesizer: 8 priors, `tag2=final-rating` average 4.4/5

---

## 7. Open questions (to resolve at coding time, not blocking)

- **OQ1:** ERC-7857 oracle re-encryption — for MVP, do we use a TEE oracle (real) or a stub `IERC7857DataVerifier` that always returns true? Stub is acceptable for hackathon; real TEE oracle is v2.
- **OQ2:** Mint fees on `AgentNFT` — set to 0 0G testnet for demo, configurable for mainnet.
- **OQ3:** `setAgentWallet` signature scheme — EIP-712 typed data signed by the agent's owner. Standard. Use OZ `EIP712` mixin.
- **OQ4:** Reputation `int128` — should we use signed (positive feedback + negative) or unsigned (always positive, 0..100)? Use signed for ERC-8004 spec compliance, but our usage is always 0..100.

---

## 8. Sources

- ERC-8004 EIP: `https://eips.ethereum.org/EIPS/eip-8004`
- ERC-8004 reference contracts: `https://github.com/erc-8004/erc-8004-contracts`
- ERC-7857 reference impl: `https://github.com/0gfoundation/0g-agent-nft`
- 0G iNFT overview: `https://docs.0g.ai/concepts/inft` (mirror in `docs/og-llms-full.txt`)
