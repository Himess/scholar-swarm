# Slide briefs for Figma — 12 slides total

> **Canvas size:** 1920×1080 (matches video output)
> **Color palette (Scholar Swarm):**
> - Background: `#0a0a0c`
> - Foreground: `#f4f4f5`
> - Accent (warm yellow): `#ffd166`
> - Mint (live/pass): `#06d6a0`
> - Code-bg: `#1a1a22`
> **Typography:**
> - Headlines: **Inter Bold** (–0.02em letter-spacing)
> - Body: **Inter Regular**
> - Code/numbers: **JetBrains Mono**
>
> **Webcam PIP:** circular crop, ~280px diameter, top-right corner. Visible on slides 1–4, 7, 8–11.
> **Logos folder:** `docs/demo-video/logos/` (0g.png, gensyn.png, keeperhub-256.png, layerzero.png, searxng.svg)

---

## Slide 1 — Title (0:00–0:08, 8s)

**Layout:** Centered.
- Top spacer: ~250px
- **`SCHOLAR SWARM`** — 140px, Inter Bold, `#f4f4f5`
- Tagline: `AutoGPT for serious research.` — 36px, Inter Medium, `#ffd166`
- Spacer: 60px
- Subtitle: `ETHGlobal Open Agents · 2026` — 22px, JetBrains Mono, `#a1a1aa`
- Bottom strip (60px tall, near bottom of canvas):
  - Label `BUILT WITH:` — 14px, JetBrains Mono, `#52525b`
  - Logos in a row: `0g.png · gensyn.png · keeperhub-256.png · layerzero.png` (~32px height each, 28px gap)

**Webcam PIP:** ON, top-right.

---

## Slide 2 — Who Am I (0:08–0:18, 10s)

**Layout:** Two-column.
- Left (40% width):
  - Big "Hi." — 96px, Inter Bold, `#ffd166`
  - "I'm Semih." — 72px, Inter Bold, `#f4f4f5`
  - "Solo developer · Türkiye" — 22px, JetBrains Mono, `#a1a1aa`
- Right (60% width):
  - Bullet list, 26px Inter Regular:
    - Smart-contract security & FHE protocols
    - Built **Scholar Swarm** in 10 days
    - Solo · Hackathon entry
  - Footer link: `github.com/Himess` — 18px, mono, accent

**Webcam PIP:** ON, top-right.

---

## Slide 3 — The Problem (0:18–0:35, 17s)

**Layout:** Centered, dramatic.
- Top: `THE PROBLEM` — 16px, mono, `#52525b`, uppercase, letter-spacing 0.1em
- Spacer: 30px
- Big quote, italic: `"AutoGPT can hallucinate sources, and you'd never know."` — 56px, Inter Italic, `#f4f4f5`
- Spacer: 50px
- Three-column grid of pain points (24px regular, `#a1a1aa`):
  - ❌ No source-fetching
  - ❌ No critic verification
  - ❌ No model attestation
- Bottom strip: `For research with stakes — security, due diligence, journalism — that's not enough.` — 22px, mono, `#52525b`

**Webcam PIP:** ON.

---

## Slide 4 — What We Built (0:35–0:55, 20s) ⭐ KEY SLIDE

**Layout:** Two-half.

### Left half (50%) — Three Mechanisms
- Header: `THREE MECHANISMS` — 18px, mono, `#52525b`
- Three cards stacked vertically (each 96px tall, 16px gap):

| Card | Icon | Title | Subtitle | Logo bottom-right |
|---|---|---|---|---|
| 1 | 🔍 | **Real source fetching** | Self-hosted SearXNG, every claim has a URL | `searxng.svg` 22px |
| 2 | ✓ | **Critic verification** | HTTP re-fetch + LLM check on every claim | `0g.png` 22px |
| 3 | 🔐 | **TEE-attested inference** | qwen2.5-7b on dstack via 0G Compute | `0g.png` 22px |

Cards: bg `#14141a`, border `1px solid #2a2a32`, radius 8px, padding 18px.

### Right half (50%) — Five iNFTs
- Header: `FIVE iNFT AGENTS` — 18px, mono, `#52525b`
- 5 cards, smaller (60px tall, 8px gap):

```
┌─────────────────────────────────┐
│ #1 │ Planner       │ 0x68c0…    │
│ #2 │ Researcher 1  │ 0x68c0…    │
│ #3 │ Researcher 2  │ 0x68c0…    │
│ #4 │ Critic        │ 0x68c0…    │
│ #5 │ Synthesizer   │ 0x68c0…    │
└─────────────────────────────────┘
```
- Each row: agent number badge (yellow circle), role name (bold), agentId tail (mono, dim).
- Footer below cards: `ERC-7857 + ERC-8004 unified · encrypted intelligence on 0G Storage` — 14px mono, `#06d6a0`
- Top-right corner of right half: small `0g.png` (24px) + `Minted on 0G Galileo` text — 12px mono.

**Webcam PIP:** ON.

---

## Slide 5 — Demo Hook (0:55–1:00, 5s)

> **Note:** This isn't a slide — it's a brief screen capture of the bounty form with overlays. Editor uses this as the demo opener.

**Visual:**
- Frontend bounty form (or terminal command).
- User types: `Compare LayerZero V2 and Wormhole for cross-chain messaging.`
- Budget field: `1 USDC`
- 1-second flash overlay at bottom: 4 sponsor logos (32px each).

**Webcam PIP:** OFF (full-screen demo).

---

## Slide 6 — Multi-process / Researchers (1:00–1:15, 15s)

> **Live demo footage** — no slide. 5 terminals tile-grid, captured during Spike 18 run.

**Visual specifics:**
- 5 terminal windows in a 2×3 grid (last cell empty or shows AXL topology).
- Each terminal header: agent role name (PLANNER, R1, R2, CRITIC, SYNTH).
- During this segment, Researcher 1 terminal should show:
  ```
  retrieval ok: 5 sources for "Compare LayerZero V2 and Wormhole..."
  fetched: medium.com/layerzero-official/...
  fetched: layerzero.network/blog/...
  ```
- Bottom-right corner: small Gensyn logo briefly (1s flash, 40px).

---

## Slide 7 — Critic Rejects (1:15–1:25, 10s) ⭐ DRAMA SCENE

> **Recorded via DEMO_REJECT_TASK_INDEX=1 procedure** — see `REJECTION_RECORDING_PROCEDURE.md`.

**Visual specifics:**
- Critic terminal full-screen.
- Logs visible (slow scroll for ~3s):
  ```
  reviewing bounty=N task=1 claims=1
  source URLs: []
  HTTP fetch: skipped (no sources)
  semantic check: supports=false ("no excerpt provided")
  reviewClaim task=1 approved=false tx=0x…
  ```
- Big red `REJECTED` badge appears as overlay (`#ef4444`, 60px, Inter Bold) for 1.5s.
- Cut: Researcher 1 terminal showing a *successful* claim with sourceUrls populated.

---

## Slide 8 — Synthesis fires LZ V2 (1:25–1:40, 15s)

> **Live demo footage** — Synthesizer terminal + 0Gscan tab.

**Visual specifics:**
- Synthesizer terminal: log line `submitSynthesis(reportRoot=0x…) tx=0x…` flashes briefly.
- Cut to 0Gscan tab: tx detail showing `Bounty.submitSynthesis` call, msg.value > 0 (LZ fee paid).
- Small inset overlay (bottom-right): LZ message GUID highlighted in mono.
- 1-second LayerZero logo flash (40px, top-right).

---

## Slide 9 — Frontend Timeline (1:40–1:55, 15s) ⭐ NEW

> **Frontend bounty detail page screen capture**.

**Visual specifics:**
- Browser screenshot of frontend bounty detail page.
- Top section: bounty title `Compare LayerZero V2 and Wormhole...` + status badge `Completed` (mint green).
- Middle section: horizontal timeline with 5 stages:
  - Open · Researching · Reviewing · Synthesizing · **Completed**
  - Each stage has timestamp + tx hash chip beneath (clickable on the live page).
- Sidebar (right): `5 distinct operator wallets · 16 on-chain tx · 6.5 min wall-clock`.
- Footer: `Powered by` strip with 4 sponsor logos (24px each, low-opacity bg `#14141a`).

---

## Slide 10 — Real USDC Distribute (1:55–2:15, 20s)

> **Basescan tab(s) screen capture**.

**Visual specifics:**
- Main tab: PaymentRouter `Distribute` event detail page on Basescan.
  - Tx hash: `0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7`
  - Highlight: `Distributed` event log with 5 recipient addresses + amounts.
- Cut between 5 recipient wallets (1 sec each) showing `+0.15 / +0.30 / +0.30 / +0.15 / +0.10 USDC` deltas.
- Bottom-right: KeeperHub logo flash (1.5s, 40px).
- Voice-over emphasis: `0.7 seconds`.

---

## Slide 11 — How It's Made (2:15–2:40, 25s) ⭐ SPONSOR SHOWCASE

**Layout:** Three-row table, each row 240px tall.
Header at top: `HOW IT'S MADE` — 24px mono, `#52525b`.

### Row 1 — 0G (8s, 0:00–0:08 of slide)
- Left: `0g.png` 120px, with text below: **`0G Labs`** — 32px Inter Bold, accent.
  - Subtext: `$15K · 2 tracks` — 16px mono, `#a1a1aa`.
- Right: bullet list (22px regular, mint check marks):
  - ✓ 5 iNFT agents minted (ERC-7857)
  - ✓ Encrypted intelligence on 0G Storage
  - ✓ TEE-attested inference (qwen2.5-7b · dstack)
  - ✓ ERC-8004 reputation registry
  - ✓ AgentRoyaltyVault (ERC-2981, 95/5 split)

### Row 2 — Gensyn AXL (8s)
- Left: `gensyn.png` 120px + **`Gensyn AXL`** — 32px Inter Bold.
  - Subtext: `$5K`.
- Right:
  - ✓ 5 OS processes, 5 separate AXL nodes
  - ✓ Cross-ISP mesh (Türkiye ↔ EU VPS)
  - ✓ MCP-over-AXL agent-to-tool routing

### Row 3 — KeeperHub (8s)
- Left: `keeperhub-256.png` 120px + **`KeeperHub`** — 32px Inter Bold.
  - Subtext: `$4.5K + $250 Builder Feedback`.
- Right:
  - ✓ Live workflow `nepsavmovlyko0luy3rpi`
  - ✓ MCP + Direct Execution REST
  - ✓ 0.7s trigger-to-confirm payouts

**Sponsor sequence is intentional**: 0G first ($15k, biggest), AXL middle (multi-process freshly demonstrated), KH last (Spike 19 closer).

**Webcam PIP:** ON.

---

## Slide 12 — Future Work (2:40–2:50, 10s)

**Layout:** Centered, two big numbered items.
- Title: `FUTURE WORK` — 18px mono, `#52525b`.
- Item 1: **`1. Reverse direction`** — 36px bold. Subtitle: `Base USDC fund → 0G bounty bind via LZ V2` — 22px mono `#a1a1aa`.
- Spacer: 30px.
- Item 2: **`2. dstack-bound TEE oracle`** — 36px bold. Subtitle: `Production verifier replacing the StubVerifier slot` — 22px mono `#a1a1aa`.

**Webcam PIP:** ON.

---

## Slide 13 — CTA / Thanks (2:50–3:00, 10s)

**Layout:** Big and centered.
- Top: `THANKS FOR WATCHING.` — 56px Inter Bold, `#f4f4f5`.
- Spacer: 40px.
- Three lines, mono:
  - `github.com/Himess/scholar-swarm` — 28px, accent.
  - `Spike 19: 0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7` — 16px mono, `#a1a1aa` (truncate to fit).
  - `app.keeperhub.com/workflows/nepsavmovlyko0luy3rpi` — 16px mono, `#a1a1aa`.
- Bottom strip: `BUILT WITH:` + 4 sponsor logos in a row (same as Slide 1).

**Webcam PIP:** ON, larger (~340px, top-right).

---

## Slide build checklist

- [ ] Figma frame: 1920×1080, dark BG `#0a0a0c`
- [ ] Import 4 logos as components
- [ ] Build slide 1 (title)
- [ ] Build slide 2 (who am I)
- [ ] Build slide 3 (problem)
- [ ] **Build slide 4 (What We Built — 3 mech cards + 5 iNFT cards) — most work**
- [ ] Build slide 11 (How It's Made — 3 rows) — second-most work
- [ ] Build slide 12 (future work)
- [ ] Build slide 13 (thanks/CTA)
- [ ] Skip slides 5–10 (those are screen captures, not slides)
- [ ] Export each slide as PNG @1× → `docs/demo-video/slide-renders/`
- [ ] DaVinci import + sequence

**Estimated Figma time:** 2–3 hours for 7 actual slide designs (slides 1, 2, 3, 4, 11, 12, 13).

---

## Webcam PIP guidelines

- **Source:** Webcam, 720p min.
- **Position:** top-right corner of frame, 24px margin from edges.
- **Crop:** circular mask, ~280px diameter on slides 1-3, 11-13. Smaller (~200px) on slides 7 (drama scene needs more terminal visibility) — or skip entirely on demo segments.
- **Background lighting:** soft front-light, no backlight (no window behind).
- **Eye-line:** look at camera, not at the screen.

## Audio guidelines

- **Mic:** USB condenser preferred, OR cardioid headset mic. NOT laptop built-in.
- **Distance:** ~10 cm, off-axis 30° (avoid plosives).
- **Room:** soft furnishings (carpet/curtains/blanket on walls). No echo.
- **Software:** OBS for capture; Audacity for cleanup (denoise, normalize to -3 LUFS).

---

## Caption guidelines

- **Tool:** DaVinci Resolve `Subtitle` track auto-generation.
- **Style:** burned-in, bottom-center, 90% width max, dark BG strip with 60% opacity, 28px Inter SemiBold, white text.
- **Synchrony:** match script word-for-word — let DaVinci auto-time, then proofread.
- **Critical fix:** "workflow" not "workshop", "zero point seven" if model auto-transcribes "0.7".
