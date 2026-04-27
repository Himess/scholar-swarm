# Scholar Swarm — Deployed Contracts

> First testnet deployment, Day 3 (2026-04-27).

## 0G Galileo Testnet (chainId 16602)

Explorer: https://chainscan-galileo.0g.ai

| Contract | Address |
|---|---|
| **AgentNFT** (ERC-7857 + ERC-8004 IdentityRegistry) | [`0x68c0175e9d9C6d39fC2278165C3Db93d484a5361`](https://chainscan-galileo.0g.ai/address/0x68c0175e9d9C6d39fC2278165C3Db93d484a5361) |
| **ReputationRegistry** (ERC-8004) | [`0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13`](https://chainscan-galileo.0g.ai/address/0xE8D84bfD8756547BE86265cDE8CdBcd8cdfC8a13) |
| **ArtifactRegistry** | [`0xB83e014c837763C4c86f21C194d7Fb613edFbE2b`](https://chainscan-galileo.0g.ai/address/0xB83e014c837763C4c86f21C194d7Fb613edFbE2b) |
| **Bounty (impl, used by clones)** | [`0x3905554071E2F121533EbB26Fcf7947C916299C1`](https://chainscan-galileo.0g.ai/address/0x3905554071E2F121533EbB26Fcf7947C916299C1) |
| **BountyFactory** | [`0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE`](https://chainscan-galileo.0g.ai/address/0x3fC3BA7e2700449Cde5F06a8DF6f5FA1E18201BE) |
| **StubVerifier** (ERC-7857 oracle stub — replace with TEE-backed) | [`0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5`](https://chainscan-galileo.0g.ai/address/0x5ceCfD0bF5E815D935E4b0b85F5a604B784CA6E5) |

Deployer / admin: `0xF505e2E71df58D7244189072008f25f6b6aaE5ae`
Relayer: same (cross-chain coordinator EOA)
Total cost: ~0.038 OG

## Base Sepolia (chainId 84532)

Explorer: https://sepolia.basescan.org

| Contract | Address |
|---|---|
| **PaymentRouter** | [`0xda6ab98bb73e75b2581b72c98f0891529eee2156`](https://sepolia.basescan.org/address/0xda6ab98bb73e75b2581b72c98f0891529eee2156) |
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
