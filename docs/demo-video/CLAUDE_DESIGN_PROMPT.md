# Prompt for Claude Design — Scholar Swarm demo video slides

> Copy everything below the `---` line. Paste into Claude Design as a single message.
> Output: one HTML artifact with 7 stacked 1920×1080 slides.
> User will screenshot each slide to PNG, drop into DaVinci.

---

# Project context

I'm building **Scholar Swarm**, a multi-agent research project for ETHGlobal Open Agents 2026 (submission deadline May 3). I need **7 slide designs** for a 3-minute demo video. Each slide is a frame in the video, so they need to be polished and information-dense at a glance.

**The pitch in one sentence:** *"AutoGPT for serious research — five specialist iNFT agents that fetch real sources, verify each other's claims, and run on TEE-attested inference."*

Tech stack the project sits on: **0G Labs** (Layer 1 for AI), **Gensyn AXL** (P2P agent communication), **KeeperHub** (cross-chain payment execution), **LayerZero V2** (cross-chain messaging), self-hosted **SearXNG** (web search), **Base Sepolia** (USDC payments).

---

# Deliverable format

A **single HTML file** with 7 stacked `<section>` blocks, each exactly **1920px × 1080px**, each rendering one finished slide. I will scroll through the page and screenshot each section to PNG.

- Use **Tailwind CSS** (CDN script tag in `<head>`) — fast, no build.
- Use **Google Fonts**: `Inter` (400, 500, 600, 700) for text, `JetBrains Mono` (400, 500) for code/numbers.
- Each section: `class="w-[1920px] h-[1080px] relative overflow-hidden"` so screenshot bounds are predictable.
- No JS animations needed (still frames). Subtle CSS hover effects fine but not required.
- Provide a tiny CSS reset / body bg to prevent scrollbars from appearing in the screenshot.

---

# Design system

**Color tokens** (define as CSS variables OR Tailwind config):
- `--bg`: `#0a0a0c` (near-black background)
- `--bg-elev`: `#14141a` (cards/panels)
- `--fg`: `#f4f4f5` (primary text)
- `--fg-dim`: `#a1a1aa` (secondary text)
- `--fg-faint`: `#52525b` (tertiary / labels)
- `--accent`: `#ffd166` (warm yellow — key highlights, kickers)
- `--mint`: `#06d6a0` (live status / pass / approved)
- `--red`: `#ef4444` (rejection / fail badge)
- `--border`: `#2a2a32` (card borders)
- `--code-bg`: `#1a1a22` (code block bg)

**Typography rules:**
- Headlines: Inter Bold, letter-spacing -0.02em, very tight leading (1.05).
- Body: Inter Regular, leading-relaxed.
- Code/numbers/IDs: JetBrains Mono.
- Kickers (small uppercase labels above headlines): JetBrains Mono, 14px, uppercase, letter-spacing 0.1em, color `--fg-faint`.

**Spacing:**
- Slide padding: `60px 70px`.
- Card padding: `24px`.
- Card radius: `8px`.
- Card border: `1px solid var(--border)`.

**Sponsor logos** (use Twitter avatar URLs as `<img src>` — they work directly, no auth):
- 0G: `https://unavatar.io/twitter/0g_labs`
- Gensyn: `https://unavatar.io/twitter/gensynai`
- KeeperHub: `https://unavatar.io/twitter/keeperhubapp`
- LayerZero: `https://unavatar.io/twitter/LayerZero_Labs`
- SearXNG: `https://raw.githubusercontent.com/searxng/searxng/master/searx/static/themes/simple/img/searxng.svg` (use as `<img>` directly)

Wrap each logo in a small rounded square panel `bg-[#14141a] border border-[#2a2a32] p-2 rounded-md` so the avatar's circle sits cleanly on the dark background.

---

# Slide 1 — Title

**Layout:** centered, dramatic. Webcam PIP placeholder top-right.

- Top spacer
- Kicker: `3-MINUTE DEMO`
- Headline: **`SCHOLAR SWARM`** — 144px Inter Bold, letter-spacing tight
- Tagline: `AutoGPT for serious research.` — 36px Inter Medium, color `--accent`, italic
- Spacer
- Subtitle: `ETHGlobal Open Agents · 2026` — 22px JetBrains Mono, color `--fg-dim`
- Bottom strip near edge:
  - Tiny label: `BUILT WITH:` (kicker style)
  - Row of 4 sponsor logos (32px each, 28px gap): 0G, Gensyn, KeeperHub, LayerZero
- Webcam PIP: top-right corner, circular `<div>` 280px diameter with placeholder text "WEBCAM" centered, dashed border `--border`, label "PIP — replace in DaVinci".

---

# Slide 2 — Who Am I

**Layout:** two-column.

Left column (40% width):
- Kicker: `SOLO BUILD`
- "Hi." — 96px Inter Bold, color `--accent`
- "I'm Semih." — 72px Inter Bold, color `--fg`
- "Solo developer · Türkiye" — 22px JetBrains Mono, color `--fg-dim`

Right column (60% width):
- Bullet list, 26px Inter Regular, leading 1.6:
  - Smart-contract security & FHE protocols background
  - Built **Scholar Swarm** in 10 days for this hackathon
  - Solo · `20 / 20` integration spikes pass
- Footer link: `github.com/Himess/scholar-swarm` — 18px JetBrains Mono, color `--accent`, underlined

Webcam PIP placeholder top-right corner (same style as Slide 1).

---

# Slide 3 — The Problem

**Layout:** centered, dramatic typography.

- Kicker (top): `THE PROBLEM`
- Big quote in italics, centered, max-width 1400px:
  > **"AutoGPT can hallucinate sources, and you'd never know."**
  56px Inter Italic Medium, color `--fg`, leading-tight.
- Spacer
- Three pain-point chips in a row, evenly spaced:
  - `❌ No source-fetching`
  - `❌ No critic verification`
  - `❌ No model attestation`
  Each chip: chip-style pill, JetBrains Mono 22px, `--fg-dim`.
- Bottom strip caption:
  `For research with stakes — security, due diligence, journalism — that's not enough.`
  22px JetBrains Mono, color `--fg-faint`.

Webcam PIP top-right.

---

# Slide 4 — What We Built ⭐ KEY SLIDE

**Layout:** Two halves, 50/50, gap 48px.

## Left half — Three Mechanisms

- Kicker: `THREE MECHANISMS`
- Three vertical cards, gap 16px, each card 96px height with the layout:
  - Big icon emoji (left, 36px) | content (middle, flex-1) | tiny logo (bottom-right, 22px)

Card 1:
  - Icon: 🔍
  - Title (Inter SemiBold 22px): **Real source fetching**
  - Subtitle (16px, `--fg-dim`): Self-hosted SearXNG · every claim has a URL
  - Logo bottom-right: SearXNG SVG, 22px

Card 2:
  - Icon: ✓
  - Title: **Critic verification**
  - Subtitle: HTTP re-fetch + LLM check on every claim
  - Logo: 0G

Card 3:
  - Icon: 🔐
  - Title: **TEE-attested inference**
  - Subtitle: qwen2.5-7b on dstack via 0G Compute
  - Logo: 0G

## Right half — Five iNFTs

- Kicker: `FIVE iNFT AGENTS`  (with tiny 0G logo + label "Minted on 0G Galileo" 12px JetBrains Mono right-aligned)
- Five horizontal rows, gap 8px, each 60px tall:

```
┌─────────────────────────────────────────────┐
│ [#1]  Planner            Agent #1 · 0x68c0… │
│ [#2]  Researcher 1       Agent #2 · 0x68c0… │
│ [#3]  Researcher 2       Agent #3 · 0x68c0… │
│ [#4]  Critic             Agent #4 · 0x68c0… │
│ [#5]  Synthesizer        Agent #5 · 0x68c0… │
└─────────────────────────────────────────────┘
```

Each row:
- Number badge (left): yellow circle 40px, white-on-yellow `#1`-`#5` text (Inter Bold)
- Role name (Inter SemiBold 22px)
- Tail (right): JetBrains Mono 16px, `--fg-dim`, format: `Agent #N · 0x68c0…`

Footer below rows (full right-half width):
- Mint-color line in JetBrains Mono 14px:
  `ERC-7857 + ERC-8004 unified · encrypted intelligence on 0G Storage`

Webcam PIP top-right (smaller, 200px to not crowd this dense slide).

---

# Slide 5 — How It's Made (sponsor showcase) ⭐ KEY SLIDE

**Layout:** Three rows, each 240px tall, with sponsor logo + bullet checklist.

- Kicker (top): `HOW IT'S MADE`

Row template (gap 16px between rows):
- Left column (280px wide): logo (120px square panel), below it the sponsor name (Inter Bold 32px) and prize tier (JetBrains Mono 16px `--fg-dim`).
- Right column (flex-1): bullet list of integrations, each line: mint check (`✓`) + bullet text in Inter Regular 22px, leading-relaxed.

Row 1 — **0G Labs**
- Tier subtitle: `$15K · 2 tracks (Framework + Swarms)`
- Bullets:
  - 5 iNFT agents minted (ERC-7857)
  - Encrypted intelligence on 0G Storage
  - TEE-attested inference (qwen2.5-7b · dstack)
  - ERC-8004 reputation registry
  - AgentRoyaltyVault (ERC-2981, 95/5 split)

Row 2 — **Gensyn AXL**
- Tier subtitle: `$5K`
- Bullets:
  - 5 OS processes, 5 separate AXL nodes
  - Cross-ISP mesh verified (Türkiye ↔ EU VPS)
  - MCP-over-AXL agent-to-tool routing

Row 3 — **KeeperHub**
- Tier subtitle: `$4.5K + $250 Builder Feedback`
- Bullets:
  - Live workflow `nepsavmovlyko0luy3rpi`
  - MCP + Direct Execution REST
  - 0.7s trigger-to-confirm payouts

Webcam PIP top-right.

---

# Slide 6 — Future Work

**Layout:** centered, two big numbered items.

- Kicker: `FUTURE WORK`
- Spacer
- Item 1 (huge):
  - Number `1.` in `--accent` 80px Inter Bold
  - Same line: **Reverse direction** — 56px Inter Bold, `--fg`
  - Subtitle (next line, indented to align with after the `1.`): `Base USDC fund → 0G bounty bind via LayerZero V2` — 22px JetBrains Mono, `--fg-dim`
- Spacer 60px
- Item 2 (huge):
  - Number `2.` in `--accent` 80px Inter Bold
  - Same line: **dstack-bound TEE oracle** — 56px Inter Bold, `--fg`
  - Subtitle: `Production verifier replacing the StubVerifier slot` — 22px JetBrains Mono, `--fg-dim`

Webcam PIP top-right.

---

# Slide 7 — Thanks / CTA

**Layout:** centered, big and warm.

- Top spacer
- Kicker: `THANKS FOR WATCHING.`
- Big headline: **`Scholar Swarm.`** — 96px Inter Bold, `--accent`
- Spacer 60px
- Three lines stacked, each in JetBrains Mono with subtle hover-link style:
  - `github.com/Himess/scholar-swarm` — 28px, `--accent`
  - `Spike 19 distribute tx · 0xa06717e4495a6df75d1127bd3b61bbc18884c91cca97c04071857589cf00f0b7` — 14px, `--fg-dim` (truncate visually if needed but keep full hash readable)
  - `KH workflow · app.keeperhub.com/workflows/nepsavmovlyko0luy3rpi` — 14px, `--fg-dim`
- Spacer
- Bottom strip near edge (same as Slide 1):
  - Kicker: `BUILT WITH:`
  - Row of 4 sponsor logos (32px each, 28px gap)

Webcam PIP top-right (larger, 340px — closing warmth).

---

# Quality bar checklist

- ✅ Every slide is exactly 1920×1080.
- ✅ Dark `#0a0a0c` background everywhere.
- ✅ Webcam PIP placeholder visible on every slide (top-right) — labeled clearly so the user knows to replace it in DaVinci.
- ✅ Sponsor logos sit cleanly on the dark BG (use the wrapper panel pattern).
- ✅ Inter for text, JetBrains Mono for code/numbers/IDs — never mix within one element.
- ✅ Yellow `--accent` is reserved for accent moments (kickers, name, link). Do not over-use.
- ✅ Mint `--mint` is for "live"/"pass" signals. Do not use elsewhere.
- ✅ No emoji in headlines (only in mechanism cards on Slide 4).
- ✅ No icons that aren't in the briefs (no decorative additions).
- ✅ All addresses, hashes, IDs are real (do not abbreviate the spike-19 tx hash on slide 7).

# Optional polish (only if time)

- Slide 1: very subtle grid pattern background at low opacity (1-2%).
- Slide 4 iNFT cards: a mint-colored "live" dot before each row.
- Slide 5 sponsor rows: alternating row backgrounds (`--bg-elev` and transparent) for readability.

---

# What I'll do with the output

1. Open the artifact in browser.
2. Use the browser's full-page screenshot tool, OR Chrome DevTools "Capture node screenshot" on each `<section>`.
3. Save 7 PNGs at 1920×1080 each.
4. Drop into DaVinci Resolve as still images.
5. Sync to my voiceover audio (already scripted).

Please don't add navigation buttons or interactivity — these are just frames for me to screenshot.
