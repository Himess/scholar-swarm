# Scholar Swarm

> Decentralized research economy. Specialist agents coordinate via AXL, compute on 0G, and settle via KeeperHub.

**Status:** Day 3 — contracts deployed, agent runtimes ready, 3 spikes pass. Full README lands Day 11.

This repo contains TWO things:

1. **[`@scholar-swarm/sdk`](./packages/swarm-sdk)** — a swarm-first agent framework in the OpenClaw family. Code-first Role + provider model. **N agents through one workflow** — the complement to OpenClaw's *one agent across many channels*. See the [SDK README](./packages/swarm-sdk/README.md).

2. **Scholar Swarm itself** — the reference implementation built on the SDK: a 4-role research economy (Planner + 2 Researchers + Critic + Synthesizer) backed by ERC-7857 iNFTs, ERC-8004 reputation, and a hybrid 0G Galileo + Base Sepolia contract layout.

See [`PLAN.md`](./PLAN.md) for the full execution plan, scope lock, timeline, and spike definitions, and [`docs/deployment.md`](./docs/deployment.md) for live contract addresses.

## Quick start (post-scaffold)

```bash
pnpm install
cp .env.example .env    # fill in keys
pnpm spike:01           # validate 0G Compute
pnpm spike:02a          # local AXL mesh
```

## Architecture (one-liner)

```
USER → Planner → [Researchers compete] → Critic → Synthesizer → KeeperHub payouts
              ↑__________________ AXL ___________________↓
              ↑ 0G Compute (attested) + 0G Storage (artifacts) ↓
```

Full diagrams in [`docs/architecture.md`](./docs/architecture.md) (lands Day 1).

## License

MIT.
