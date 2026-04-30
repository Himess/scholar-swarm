# Scholar Swarm — frontend

A **demo-mode visual frontend** for [Scholar Swarm](https://github.com/Himess/scholar-swarm), submitted to ETHGlobal Open Agents 2026.

> One-line pitch: *"AutoGPT for serious research — five specialist iNFT agents that fetch real sources, verify each other's claims, and run on TEE-attested inference."*

This is **not** a fully functional dApp — there is no wallet connect, no contract writes, no backend. It's a polished, static visual layer that mirrors **real on-chain state** from our Spike 18 (multi-process bounty choreography) + Spike 19 (Circle USDC payout) + Spike 20 (SearXNG retrieval over MCP-over-AXL) PASS runs and links out to actual block explorers (Basescan, 0Gscan) for verification.

## Routes

- `/` — Bounty post page (hero, form, "what happens next").
- `/bounty/20` — Bounty detail timeline (lifecycle, tx chips, cross-chain payout, recipient wallets).

The `[id]` route param is currently unused — every bounty resolves to the same hardcoded demo data so screenshots stay deterministic.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v3** (custom design tokens in `tailwind.config.ts` + `app/globals.css`)
- **Framer Motion** (timeline node entry animation)
- **next/font/google** (Inter + JetBrains Mono)
- No backend, no DB, no wallet integration — all data hardcoded in `lib/demo-data.ts`.

## File map

```
app/
  layout.tsx              ← root layout (loads Inter + JetBrains Mono)
  page.tsx                ← / (bounty post)
  bounty/[id]/page.tsx    ← /bounty/:id (detail timeline)
  globals.css             ← design tokens + utility classes
components/
  Nav.tsx                 ← top nav (60px)
  SponsorStrip.tsx        ← logo tile row
  Timeline.tsx            ← 5-node lifecycle (Framer Motion)
  TxChip.tsx              ← horizontal tx chip strip
  CrossChainPanel.tsx     ← LayerZero → KeeperHub flow panel
  RecipientCard.tsx       ← 5 operator wallets + USDC delta
lib/
  demo-data.ts            ← all real on-chain constants
                            (BOUNTY, lzGuid, finalReportRoot,
                             khDistributeTx, txHashes, RECIPIENTS, SPONSORS)
```

## Real on-chain values (from `lib/demo-data.ts`)

- `BOUNTY.id` = 20
- `BOUNTY.user` = `0xF505e2E71df58D7244189072008f25f6b6aaE5ae`
- `lzGuid` = `0x0c6eb880…985a6ad` (LayerZero V2 cross-chain message)
- `finalReportRoot` = `0xc013b49b…e8889a22` (0G Storage root)
- `khDistributeTx` = `0xa06717e4…cf00f0b7` (Circle USDC on Base Sepolia)
- 5 operator wallets (Planner / R1 / R2 / Critic / Synthesizer) with their real 0x addresses + USDC deltas

All explorer links go to:
- 0G txs:        `https://chainscan-galileo.0g.ai/tx/<hash>`
- 0G addresses:  `https://chainscan-galileo.0g.ai/address/<addr>`
- Base txs:      `https://sepolia.basescan.org/tx/<hash>`

## Develop

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 — design target is **1920×1080** for video screenshots and 1280–1440 for the live judge experience.

## Build

```bash
pnpm build
pnpm start
```

## Deploy to Vercel

```bash
vercel deploy --prod
```

Submit the resulting `*.vercel.app` URL as the ETHGlobal "live demo link".

## Design system (dark theme)

| Token         | Value     | Use                             |
|---------------|-----------|---------------------------------|
| `--bg`        | `#0a0a0c` | page background (everywhere)    |
| `--bg-elev`   | `#14141a` | cards, panels                   |
| `--fg`        | `#f4f4f5` | primary text                    |
| `--fg-dim`    | `#a1a1aa` | secondary text                  |
| `--fg-faint`  | `#52525b` | kickers, labels                 |
| `--accent`    | `#ffd166` | warm yellow — kickers, CTA      |
| `--mint`      | `#06d6a0` | live, completed, paid signals   |
| `--blue`      | `#60a5fa` | LayerZero accent                |
| `--border`    | `#2a2a32` | card borders                    |
| `--code-bg`   | `#1a1a22` | code blocks, hash containers    |

Inter for titles + body. JetBrains Mono for **all** hashes, addresses, IDs, timestamps.

## Sponsor integrations (grep targets)

Judges from 0G, Gensyn, KeeperHub, LayerZero, and SearXNG can grep for their integration points:

- `lzGuid` — LayerZero V2 cross-chain message GUID
- `finalReportRoot` — 0G Storage report root hash
- `khDistributeTx` — KeeperHub PaymentRouter.distribute tx
- `txHashes.broadcastSubTasks` / `acceptBids` / `submitDraft` / `submitReview` / `submitSynthesis` — all major Bounty.sol stage transitions

## License

MIT
