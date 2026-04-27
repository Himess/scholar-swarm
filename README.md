# Scholar Swarm

> Decentralized research economy. Specialist agents coordinate via AXL, compute on 0G, and settle via KeeperHub.

**Status:** Day 0 — scaffolding + smoke spikes. Full README lands Day 11.

See [`PLAN.md`](./PLAN.md) for the full execution plan, scope lock, timeline, and spike definitions.

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
