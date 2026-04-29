# Prompt for Claude Design — Scholar Swarm frontend (2 pages)

> Copy everything below the `---` line. Paste into Claude Design as a single message.
> Output: a **Next.js 15 project** (code artifact, App Router) with two routes — used both for demo-video screenshots AND deployed to Vercel as the submission's live demo link.

---

# Project context

I'm building **Scholar Swarm** for ETHGlobal Open Agents 2026. Public repo: **https://github.com/Himess/scholar-swarm**.

**Recommended files to skim** (please read 2-3 of these before designing):
- `README.md` — full project pitch, architecture, status table, sponsor list
- `docs/spike-results.md` — every milestone test on-chain, with real tx hashes
- `docs/spike-artifacts/spike-19.json` (if visible in repo browser) — distribution proof

**One-line pitch:** *"AutoGPT for serious research — five specialist iNFT agents that fetch real sources, verify each other's claims, and run on TEE-attested inference."*

**Tech stack name-dropping (judges expect to see these):** 0G Labs, Gensyn AXL, KeeperHub, LayerZero V2, ERC-7857 iNFTs, ERC-8004 reputation, SearXNG.

---

# What this frontend is for

This is **NOT a fully functional dApp** — no real wallet connect, no real contract writes. It's a **demo-mode visual layer** that:

1. Appears in the demo video for ~20 seconds total (in two short cuts: a "post bounty" form moment and a "bounty timeline" moment).
2. Gets deployed to Vercel as the submission's *"live demo link"* — judges click it, see polished UI mirroring real on-chain state, and click out to Basescan / 0Gscan to verify.

So: **make it look real, use real on-chain data as the "demo bounty" content, and link out to actual block explorers**. Don't over-engineer.

---

# Deliverable format

Output a **Next.js 15 project** (App Router) — code artifact, not a single HTML file. The judges will visit the live URL AND likely browse the source on GitHub, so component structure matters.

**Two routes:**
- `/` (home, default) — bounty post page (5s in video)
- `/bounty/20` — bounty detail timeline page (15s in video)

**Stack:**
- Next.js 15 App Router, TypeScript
- Tailwind CSS v4 (or v3 — whatever Claude Design defaults to)
- Framer Motion for the timeline pulse animation
- Inter + JetBrains Mono via `next/font/google`
- No backend, no database, no real wallet — all data is hardcoded in `lib/demo-data.ts`

**File structure to produce:**
```
app/
  layout.tsx
  page.tsx                    ← bounty post page
  bounty/
    [id]/
      page.tsx                ← bounty detail page (id parameter unused, just renders the demo)
  globals.css
components/
  Nav.tsx
  SponsorStrip.tsx
  Timeline.tsx                ← the centerpiece animation
  TxChip.tsx
  CrossChainPanel.tsx
  RecipientCard.tsx
lib/
  demo-data.ts                ← all the real on-chain data (constants)
tailwind.config.ts
package.json
README.md                     ← setup + dev/build/deploy instructions
```

Pages render at any viewport but the design target is **1920×1080** for video screenshots and **1280–1440 desktop** for the live judge experience. Mobile responsive is OK if it falls out naturally; not a requirement.

---

# Design system — DARK THEME (must match the slide deck)

```
--bg:         #0a0a0c   /* near-black */
--bg-elev:    #14141a   /* cards, panels */
--fg:         #f4f4f5   /* primary text */
--fg-dim:     #a1a1aa   /* secondary text */
--fg-faint:   #52525b   /* labels, kickers */
--accent:     #ffd166   /* warm yellow — kicker, CTA */
--mint:       #06d6a0   /* live, pass, completed */
--red:        #ef4444   /* fail, rejected */
--blue:       #60a5fa   /* LayerZero accent */
--border:     #2a2a32   /* card borders */
--code-bg:    #1a1a22   /* code blocks */
```

**Typography rules:**
- Headlines: Inter Bold, letter-spacing -0.02em, leading 1.05.
- Body: Inter Regular.
- Code, hashes, addresses, IDs: JetBrains Mono.
- Kickers (small uppercase labels): JetBrains Mono, 12-14px, uppercase, letter-spacing 0.1em, color `--fg-faint`.

**Sponsor logo URLs** (use as `<img>`):
- `https://unavatar.io/twitter/0g_labs`
- `https://unavatar.io/twitter/gensynai`
- `https://unavatar.io/twitter/keeperhubapp`
- `https://unavatar.io/twitter/LayerZero_Labs`
- `https://raw.githubusercontent.com/searxng/searxng/master/searx/static/themes/simple/img/searxng.svg`

Wrap each in: `<div class="bg-[#14141a] border border-[#2a2a32] p-2 rounded-md">`.

---

# Page 1 — `#/post` (Home, bounty post form)

**Used in video at 0:55–1:00 (5 seconds).** User types a bounty into the form; we cut away just as they hit submit.

## Layout (full viewport)

### Top nav (60px tall)
- Left: small "🐝 SCHOLAR SWARM" wordmark + the tagline `AutoGPT for serious research.` in `--fg-dim`.
- Right: 3 nav links (mono, --fg-dim): `EXPLORE` · `DOCS` · `GITHUB ↗` (linking to `https://github.com/Himess/scholar-swarm`).

### Hero band (centered)
- Kicker: `POST A RESEARCH BOUNTY`
- Headline: **`Five specialist iNFT agents,`** (line 1, `--fg`) **`one verified report.`** (line 2, `--accent`)
  - 56-72px Inter Bold, leading-tight.
- Subheadline (22px, `--fg-dim`, max-width 720px):
  > Real source-fetching. Independent critic. TEE-attested inference. Cross-chain payouts in 0.7 seconds.

### Form card (centered, max-width 800px)
- Card background `--bg-elev`, border, radius 12px, padding 32px.
- Field 1: **Goal**
  - Label: `RESEARCH GOAL` (kicker)
  - Textarea, 4 rows, prefilled with this real Spike 18 goal (so the demo uses our real research):
    > Compare the security models of LayerZero V2 and Wormhole as of 2026: how each handles message attestation, who runs the verifying nodes, and one concrete vulnerability disclosed against either in the past 18 months.
- Field 2: **Budget** (USDC) — number input, prefilled `1` (small for demo realism).
  - Right of input: small note (`--fg-dim`, mono): `paid in USDC on Base · settled by KeeperHub`
- Field 3: **Fee schedule** (collapsed by default, expandable)
  - Show a small breakdown when expanded: Planner 15% · Researchers 60% · Critic 15% · Synthesizer 10%.
- Submit button: full-width, accent yellow, dark text, 18px Inter SemiBold.
  - Label: `Post bounty →`
  - On hover: subtle glow.
- **Demo-mode notice** (below button, `--fg-faint`, 12px mono, with a dot icon):
  > demo mode · clicking submit links to live bounty #20 on 0G Galileo

### Trust strip (bottom of hero, full width thin band)
- Small kicker `BUILT WITH:` then 4 sponsor logos in a row (32px each).

### Below the form: 3-column "what happens next" preview
Each column 1/3 width, gap 24px, simple icon + 2 lines:
- `Step 1 — Plan & Bid` · *Planner agent decomposes your goal. Researchers bid for sub-tasks.*
- `Step 2 — Verify` · *Critic re-fetches every cited URL and runs an independent attested LLM check.*
- `Step 3 — Pay` · *Bounty contract fires LayerZero V2 to Base. KeeperHub distributes USDC in 0.7s.*

---

# Page 2 — `#/detail` (Bounty detail timeline) ⭐ MAIN FRONTEND MOMENT

**Used in video at 1:40–1:55 (15 seconds).** This is the polished hero of the frontend.

## Real data to populate (from the actual Spike 18 PASS run)

```
Bounty ID:        20
Bounty contract:  (use placeholder 0x4a6FE339...F0f2 — explorer will resolve)
User:             0xF505e2E71df58D7244189072008f25f6b6aaE5ae
Status:           Completed
Wall-clock:       6 min 31 sec
Total chain tx:   16
Distinct signers: 5

Goal: "Compare the security models of LayerZero V2 and Wormhole as of 2026:
       how each handles message attestation, who runs the verifying nodes,
       and one concrete vulnerability disclosed against either in the past
       18 months."

Cross-chain LayerZero V2 GUID: 0x0c6eb88031ea51b3eaa6c6cbb10fab7fcc419eefc4262925ecd29e284985a6ad
Final report root (0G Storage): 0xc013b49b178d0ce16959ae9716a5891532b655b8783ef19936825f50e8889a22

USDC payout (Spike 19, real Circle USDC on Base Sepolia):
  Distribute tx: 0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7
  Recipients: 5 wallets, 0.15 / 0.30 / 0.30 / 0.15 / 0.10 USDC

Agent operator wallets:
  Planner       0xa2F013d23ebAF75F2C44e5FE5F84d3351141d28b
  Researcher 1  0xfD7940898dC454F7270E1674dCaeb1dDE7F87260
  Researcher 2  0x869fe9e353AA2cd9A2C0b5144ABFf33f2d730258
  Critic        0x9A5f0650b4870eF944be1612f3139fb36885e018
  Synthesizer   0xe9A52F8794c7053fc4B3110c9b9E26EE9ac6D3F0
```

## Layout

### Header band (full width, 120px tall)
- Left: back arrow + small breadcrumb `Bounties · #20`.
- Below it (large): **bounty title** in 36px Inter SemiBold, then the long goal text in 18px `--fg-dim`, max 2 lines with ellipsis.
- Right side: status pill, mint-color, big — `● COMPLETED` (with mint live-dot prefix). Below it, small mono: `6 min 31 sec · 16 tx · 5 signers`.

### Three-column meta bar (just under header, ~64px tall, full width, `--bg-elev`)
- Column 1: `BUDGET` kicker · `1.000000 USDC` (Inter SemiBold 24px) · subtitle `paid · Base Sepolia · KH-signed` (mono, dim).
- Column 2: `BOUNTY ID` kicker · `#20` (mono SemiBold 24px) · subtitle truncated bounty contract address (mono, dim, with copy icon).
- Column 3: `LZ V2 GUID` kicker · `0x0c6eb880…6ad` (mono SemiBold 24px) · subtitle `0G → Base · DVN-attested · ~40s` (mono, dim).

### MAIN: Lifecycle timeline (centered, max-width 1400px)
Horizontal timeline with **5 nodes** representing each Bounty.sol state. This is the centerpiece of the page.

```
●━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━●
Open              Researching       Reviewing         Synthesizing      Completed
+0s               +75s              +236s             +411s             +411s
```

Each node:
- Circle 32px diameter, mint fill, white inner dot (looks "lit up" since all completed).
- Label below: stage name (Inter SemiBold 18px) + timestamp (mono 14px `--fg-dim`).

Connecting line: 2px mint, with subtle pulse animation (CSS only).

**Below the timeline: tx detail strip**, scrollable horizontally if needed. For each major stage, a card chip:

```
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ broadcastSubTasks  +75s     │ │ submitSynthesis    +411s    │
│ Planner · 0xb372…           │ │ Synthesizer · 0xa0e6…       │
│ ↗ View on 0gscan            │ │ ↗ View on 0gscan            │
└─────────────────────────────┘ └─────────────────────────────┘
```

Include 4-6 of these chips, real tx hashes from above. Each chip is `--bg-elev`, border, padded, with hover lift effect. The `↗ View on 0gscan` link should actually link to:
`https://chainscan-galileo.0g.ai/tx/<hash>`

### Cross-chain payout panel (full-width strip)
After the timeline, a distinct panel showcasing the LayerZero → KeeperHub payout flow:

```
┌──────────────────────────────────────────────────────────────────┐
│  CROSS-CHAIN PAYOUT                          ● PAID · 0.7s       │
│                                                                  │
│  [0G logo]  Bounty.submitSynthesis  ──LZ V2──▶  PaymentMessenger │
│             ↓                                   ↓                │
│             0x0c6eb880…6ad (GUID)              KH workflow       │
│                                                 ↓                │
│                              [KH logo]  PaymentRouter.distribute │
│                                         tx 0xa06717e4…f0b7  ↗    │
└──────────────────────────────────────────────────────────────────┘
```

Visually: stack vertically on narrow, side-by-side on wide. Use `--blue` for the LZ arrow, `--mint` for the "PAID" indicator. Logos in tiles (same pattern as everywhere).

### Recipient wallets (grid, 5 cards in a row OR 2-3 wrap)
Each card: `--bg-elev`, border, radius 8px, padding 18px:
- Top: role name (Inter SemiBold 18px) + agent ID badge (#1-#5, yellow circle).
- Middle: wallet address (mono, full or truncated with copy).
- Bottom: USDC delta in mint color (`+0.15 USDC` etc.) + small text `delta from distribute tx ↗`.

Five cards in order Planner / R1 / R2 / Critic / Synthesizer with the amounts listed above.

### Footer band (full width, 60px)
- Left: `15/19 spikes drawn from this run · Spike 18 + Spike 19` (mono, dim).
- Right: `BUILT WITH:` + 4 sponsor logos.

---

# Quality bar checklist

- ✅ Dark theme, never light. Background everywhere `#0a0a0c`.
- ✅ All addresses, tx hashes, GUIDs are the EXACT real values listed above. Do not abbreviate beyond the visual `0x...…0x...` truncation pattern.
- ✅ All explorer links point to real URLs:
  - 0G txs: `https://chainscan-galileo.0g.ai/tx/<hash>`
  - 0G addresses: `https://chainscan-galileo.0g.ai/address/<addr>`
  - Base txs: `https://sepolia.basescan.org/tx/<hash>`
- ✅ Sponsor logos use the wrapper tile pattern (panel with border).
- ✅ JetBrains Mono used for ALL hashes / addresses / IDs / timestamps. Inter for titles + body.
- ✅ Yellow `--accent` only for kickers + CTA + key call-out moments.
- ✅ Mint `--mint` only for "live", "completed", "paid", "approved" signals.
- ✅ Hash-based routing works (`#/post` and `#/detail`); default to `#/post`.
- ✅ Mobile-friendly is OK but not required; design for 1920×1080.

---

# What I'll do with the output

1. Save the project to `Desktop/scholar-swarm-frontend/`.
2. `pnpm install`, `pnpm dev`, sanity-check both routes locally at 1920×1080.
3. Take browser screenshots of `/` and `/bounty/20` for the demo video (DaVinci).
4. `vercel deploy --prod` — get a `*.vercel.app` URL.
5. Submit that URL as ETHGlobal "live demo link"; judges click and see polished UI mirroring real on-chain state.

Please don't add real wallet integration, contract calls, or any onboarding flows. Hardcode everything in `lib/demo-data.ts`. The README in the output should explain that this is a demo-mode visual frontend, not a fully functional dApp.

Component breakdown should be clean and obvious if a reviewer opens the source — judges from 0G / Gensyn / KeeperHub may grep for their integration points, so name files / variables clearly (`txHashes.broadcastSubTasks`, `lzGuid`, `khDistributeTx`, etc.).
