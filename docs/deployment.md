# Scholar Swarm — Deployed Contracts

> Initial testnet deployment Day 3 (2026-04-27); V2 Bounty + AgentRoyaltyVault landed Day 5-7. Last updated Day 11 (2026-05-01).

## 0G Galileo Testnet (chainId 16602)

Explorer: https://chainscan-galileo.0g.ai

### Active production contracts (V2 — current)

| Contract | Address |
|---|---|
| **AgentNFT** (ERC-7857 + ERC-8004 IdentityRegistry) | [`0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`](https://chainscan-galileo.0g.ai/address/0x68c0175e9d9C6d39fC2278165C3Db93d484a5361) |
| **ReputationRegistry** (ERC-8004) | [`0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13`](https://chainscan-galileo.0g.ai/address/0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13) |
| **ArtifactRegistry** | [`0xB83e014c837763C4c86f21C194d7Fb613edFbE2b`](https://chainscan-galileo.0g.ai/address/0xB83e014c837763C4c86f21C194d7Fb613edFbE2b) |
| **Bounty impl V2** (cloned per job; `payable submitSynthesis` auto-fires LZ V2) | [`0xf36fEA634e48B67968567e04e75cd6b2A2698DAE`](https://chainscan-galileo.0g.ai/address/0xf36fEA634e48B67968567e04e75cd6b2A2698DAE) |
| **BountyFactory V2** (`createBountyWithSettlement` wires messenger + role fees + auto-authorizes new bounty on messenger) | [`0xdcCcce054BA878ecbe7dC540F9370040BEd7629d`](https://chainscan-galileo.0g.ai/address/0xdcCcce054BA878ecbe7dC540F9370040BEd7629d) |
| **BountyMessenger** (LayerZero V2 OApp · sender of `notifyCompletion`) | [`0x55b4bccdef026c8cbf5ab495a85aa28f235a4fed`](https://chainscan-galileo.0g.ai/address/0x55b4bccdef026c8cbf5ab495a85aa28f235a4fed) |
| **AgentRoyaltyVault** (ERC-2981, 95/5 owner/creator split, pay-to-authorize) | [`0x61cb7bfca6ad0cb050ab227cb22710a932582c61`](https://chainscan-galileo.0g.ai/address/0x61cb7bfca6ad0cb050ab227cb22710a932582c61) |
| **StubVerifier** (ERC-7857 oracle stub — TEE-backed verifier is v2) | [`0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5`](https://chainscan-galileo.0g.ai/address/0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5) |

### Archived V1 deployments (preserved for [Spike 11](./spike-results.md) historical lifecycle reference)

| Contract | Address |
|---|---|
| **Bounty impl V1** (pre-LZ-integration, archived) | [`0x3905554071E2F121533EbB26Fcf7947C916299C1`](https://chainscan-galileo.0g.ai/address/0x3905554071E2F121533EbB26Fcf7947C916299C1) |
| **BountyFactory V1** (pre-LZ-integration, archived) | [`0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE`](https://chainscan-galileo.0g.ai/address/0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE) |

Deployer / admin: `0xF505e2E71df58D7244189072008f25f6b6aaE5ae`
Total deploy cost: ~0.05 OG across all contracts

## Base Sepolia (chainId 84532)

Explorer: https://sepolia.basescan.org

| Contract | Address |
|---|---|
| **PaymentRouter** (USDC escrow + multi-distribute) | [`0xda6ab98bb73e75b2581b72c98f0891529eee2156`](https://sepolia.basescan.org/address/0xda6ab98bb73e75b2581b72c98f0891529eee2156) |
| **PaymentMessenger** (LayerZero V2 OApp · `_lzReceive` → emits `DistributeRequested`) | [`0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4`](https://sepolia.basescan.org/address/0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4) |
| **USDC (canonical)** | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |

PaymentRouter constructor:
- token = USDC above
- keeper = `0x7109C8e3B56C0A94729F3f538105b6916EF5934B` (KH Para wallet)
- owner = `0xF505e2E71df58D7244189072008f25f6b6aaE5ae`

Deploy tx: `0xae6462461f6bf06cf6f8457d0e4542542262b61946eed2bba349957b00986fd7`
Cost: ~0.000012 ETH

## Reproduce

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

## Spike proofs

| Spike | Status | TX |
|---|---|---|
| 1. 0G Compute inference | ✅ | `0x71bbe4e7…`, `0x777aed7e…`, `0x1fac5a5f…` (Galileo) |
| 4. KH execute (Base transfer) | ✅ | `0x6ca23a64…91b` (Base Sepolia) |
| 5. 0G Storage roundtrip | ✅ | `0x3e1be7e1…fe5` (Galileo storage) |
| 9. LZ V2 cross-chain (0G→Base) | ✅ | send `0x2f758adf…ad47` / recv `0x73a02576…a5bc` / [LZ Scan](https://testnet.layerzeroscan.com/tx/0x2f758adf57c491466b2c73aa40f1410fc114abca246fb41ca45619984a36ad47) |

## LayerZero V2 OApps (Day 5)

| Contract | Address | Chain |
|---|---|---|
| `BountyMessenger` | [`0x55b4bccdef026c8cbf5ab495a85aa28f235a4fed`](https://chainscan-galileo.0g.ai/address/0x55b4bccdef026c8cbf5ab495a85aa28f235a4fed) | 0G Galileo, EID 40428 |
| `PaymentMessenger` | [`0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4`](https://sepolia.basescan.org/address/0x1a4aad2bc39934fa0256e279b8a9377d708a8cd4) | Base Sepolia, EID 40245 |

Peers wired both directions. DVN: LayerZero Labs.

## Minted Agent iNFTs (ERC-7857) — 0G Galileo

All five Scholar Swarm agents are minted as ERC-7857 iNFTs at `AgentNFT` (`0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`). Each has:

- AES-256-GCM-encrypted intelligence stored on 0G Storage
- Symmetric key bundled in `iNFT.encryptedKey` (TEE-bound re-encryption is v2)
- `intelligenceRoot` field on-chain points at the storage merkle root

| agentId | Name | Role | Storage Root | Mint TX |
|---|---|---|---|---|
| 1 | Planner-Alpha | Planner | `0x5bf94ba24417…` | [`0xe4b865af…51c37`](https://chainscan-galileo.0g.ai/tx/0xe4b865afd71bff9070b2d42109d26b6dc5b602ffd02ae48a0d8e91fbe5251c37) |
| 2 | Researcher-One | Researcher | `0x6ff1668a8e0b…` | [`0x7405886a…39ffa`](https://chainscan-galileo.0g.ai/tx/0x7405886aa995eb34e0b0ef5f43f4db0819a5e946bb237bffb82ea52645f39ffa) |
| 3 | Researcher-Two | Researcher | `0xddcde3746fc2…` | [`0x1edb1817…8be57`](https://chainscan-galileo.0g.ai/tx/0x1edb1817d524eda007e8a9beffa1d045eda6c43fde85342650538a77f08ebe57) |
| 4 | Critic-Prime | Critic | `0x14b122824a89…` | [`0x87f4b714…e5211`](https://chainscan-galileo.0g.ai/tx/0x87f4b7141e915660ee60a32d815f355523cf41347d7fa3e7d246e6c01a4e5211) |
| 5 | Synthesizer-Final | Synthesizer | `0x5053fc01c8a7…` | [`0x0cb6c4d9…b1778`](https://chainscan-galileo.0g.ai/tx/0x0cb6c4d91150932a89eab960eaf0c034b1faa5a3146e95822e12a33df3ab1778) |

Full artifact: [`spike-artifacts/minted-agents.json`](spike-artifacts/minted-agents.json)

This satisfies the 0G **Best Autonomous Agents, Swarms & iNFT** track requirement: *"link to the minted iNFT on 0G explorer + proof that the intelligence/memory is embedded."*

## Day 6 #A — Synthesizer authorized to fire LZ message

Prep for the on-chain `Bounty.submitSynthesis → BountyMessenger.notifyCompletion` integration:

- Synthesizer operator wallet `0xe9A52F8794c7053fc4B3110c9b9E26EE9ac6D3F0` topped up to **0.5 OG** (LZ V2 fee per Spike 9 = ~0.345 OG)
  - tx `0xb6e5cd78cc766b33f5335a0c77ccfc51f6e7c99d835acf9d781cafaf20c9310e`
- BountyMessenger `setAuthorized(synthesizer, true)` on 0G Galileo
  - tx `0xae689c871258a0c281a6a7f914c509290d20a6020e20480a67065ef6912f813e`

The Synthesizer agent runtime can now invoke `notifyCompletion()` directly after `Bounty.submitSynthesis` lands. Wired into `apps/agent-synthesizer` runtime in Day 8 (E2E test).
