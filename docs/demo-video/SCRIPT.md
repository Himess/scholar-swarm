# Scholar Swarm — Demo Video Script

> **Target:** 2:58 (safe margin under 0G's "under 3 mins" requirement; ETHGlobal min 2:00). Real voice (no TTS). Captions burned-in. 1080p+.
>
> **Total word count:** ~395 across 2:58 ≈ 133 words/min — comfortable, not rushed.
> **Recording note:** Speak slow. Pause between segments. Re-take per segment is fine; we cut later.

---

## 🎬 Segment-by-segment

### [0:00–0:08] · TITLE SLIDE · 8s

**Visual:**
- Light cream background, "SCHOLAR SWARM" big bold center, tagline below.
- Bottom strip: `Built with: 0G · Gensyn AXL · KeeperHub` (3 sponsors only — LZ is infra not a prize track)
- No webcam, slide-only.

**Voiceover (≈18 words):**
> "Scholar Swarm — AutoGPT for serious research. Built solo for ETHGlobal Open Agents 2026."

---

### [0:08–0:18] · WHO AM I · 10s

**Visual:**
- Slide: "Hi. I'm Semih." + "Solo developer · Türkiye" + 2-3 bullets.

**Voiceover (≈22 words):**
> "Hi, I'm Semih. Solo developer from Türkiye. Smart-contract security background. I built Scholar Swarm in ten days for this hackathon."

---

### [0:18–0:35] · THE PROBLEM · 17s

**Visual:**
- Slide: bold quote: *"AutoGPT can hallucinate sources, and you'd never know."*
- Subtitle: "Multi-agent research today: claims with no verification, no source-fetch, no attestation."

**Voiceover (≈40 words):**
> "Here's the problem. AutoGPT-style research agents can hallucinate sources — and the user has no way to know. The agent says 'according to a 2023 study'. That study might not exist. For research with stakes, that's not good enough."

---

### [0:35–0:55] · WHAT WE BUILT · 20s

**Visual:**
- Left half: 3 mechanism cards (icons + 1-line each):
  - 🔍 *Real source fetching* — Self-hosted SearXNG · [SearXNG logo]
  - ✓ *Critic verification* — HTTP re-fetch + LLM check · [0G logo]
  - 🔐 *TEE-attested inference* — qwen2.5-7b on dstack · [0G logo]
- Right half: 5 iNFT cards stacked, each with:
  - Role name (Planner / Researcher 1 / Researcher 2 / Critic / Synthesizer)
  - Agent ID badge (#1 → #5)
  - "Encrypted intelligence on 0G Storage" badge
  - "ERC-7857 + ERC-8004" footer
- Top-right corner: tiny 0G logo + "Minted on 0G Galileo" text.

**Voiceover (≈45 words):**
> "Five specialist agents — each minted as an ERC-7857 iNFT on 0G Galileo, with encrypted intelligence on 0G Storage. Each has its own wallet, reputation, and Compute ledger. Three guarantees: real source fetching, independent critic verification, TEE-attested inference."

---

### [0:55–1:00] · DEMO HOOK · 5s

**Visual:**
- Frontend bounty form (or terminal command), user types:
  > *"Compare LayerZero V2 and Wormhole for cross-chain messaging."* · Budget: **1 USDC**
- 1-second flash overlay: stack of 4 sponsor logos at bottom (0G · AXL · KH · LZ).

**Voiceover (≈14 words):**
> "A user posts a research bounty. One USDC. Watch the swarm."

---

### [1:00–1:15] · MULTI-PROCESS REVEAL + RESEARCHERS · 15s

**Visual:**
- 5 terminal windows tile-grid (each running an agent runtime). Headers visible: PLANNER / R1 / R2 / CRITIC / SYNTH.
- Highlight Researcher 1: SearXNG fetch logs visible (`5 sources fetched · medium.com/layerzero...`).
- Bottom-right corner: AXL logo brief flash during AXL message frames.

**Voiceover (≈35 words):**
> "Five OS processes. Five Gensyn AXL nodes. Five separate 0G Compute ledgers. Researchers fetch real sources from self-hosted SearXNG. Every claim carries a URL — no hallucination."

---

### [1:15–1:25] · CRITIC REJECTS — DRAMA · 10s

**Visual:**
- Critic terminal zooms in. Log lines:
  ```
  Critic checking claim 2/3...
  Source: <weak-source-url>
  Re-fetching URL...   200 OK
  LLM verdict: REJECTED — source does not support claim
  Emitting reviewClaim(approved=false, ...)
  ```
- Red `REJECTED` badge flashes on screen.
- Cut: Researcher 1 retries with new SearXNG result.

**Voiceover (≈30 words):**
> "The Critic re-fetches every cited URL and runs a separate attested LLM check. Watch — this one fails. The source doesn't support the claim. Researcher retries."

---

### [1:25–1:40] · SYNTHESIS FIRES LZ V2 · 15s

**Visual:**
- Synthesizer terminal: `submitSynthesis(reportRoot)` tx hash flashes.
- Cut to 0Gscan tab: tx detail page visible briefly. LZ message GUID highlighted.
- Bottom-right corner: LayerZero logo flash.

**Voiceover (≈30 words):**
> "On synthesis, the bounty contract itself fires a LayerZero V2 message to Base — DVN-attested, no off-chain relayer in the critical path."

---

### [1:40–1:55] · FRONTEND TIMELINE · 15s

**Visual:**
- Frontend bounty detail page (live URL):
  - Top: bounty title + status `Completed`
  - Middle: timeline visualization with stages (Open → Researching → Reviewing → Synthesizing → Completed)
  - Each stage shows tx hashes inline (clickable)
  - Sidebar: "5 distinct operator wallets · 16 on-chain tx"
- Subtle "Powered by" strip at footer.

**Voiceover (≈30 words):**
> "Here's the full timeline on the frontend. Sixteen on-chain transactions from five different wallets. The cross-chain message lands on Base in about forty seconds."

---

### [1:55–2:15] · REAL USDC DISTRIBUTE · 20s

**Visual:**
- Basescan tab: PaymentRouter `Distributed` event. KH-signed `distribute` tx (`0xa06717e4…`).
- Cut to 5 wallet balance pages on Basescan, each showing +0.15 / +0.30 / +0.30 / +0.15 / +0.10 USDC.
- KeeperHub logo flash.

**Voiceover (≈35 words):**
> "KeeperHub workshop signs the payout in zero point seven seconds. One USDC distributed atomically across five operator wallets. The keeper is KeeperHub's Para wallet — we never held its key."

> ⚠ Correction: "**workflow**" not "workshop". Re-record this line if mispronounced.

---

### [2:15–2:45] · HOW IT'S MADE · 30s

**Visual:** Three-row table, each row a sponsor logo + bullet list. Order is strategic.

**Row 1: 0G** (8s)
- 5 iNFT agents minted (ERC-7857)
- Encrypted intelligence on 0G Storage
- TEE-attested inference (qwen2.5-7b / dstack)
- ERC-8004 reputation registry
- AgentRoyaltyVault (95/5 ERC-2981)

**Row 2: Gensyn AXL** (8s)
- 5 OS processes, 5 separate AXL nodes
- Cross-ISP mesh verified (TR ↔ EU VPS)
- MCP-over-AXL agent-to-tool routing

**Row 3: KeeperHub** (8s)
- Live workflow `nepsavmovlyko0luy3rpi`
- MCP + Direct Execution REST
- 0.7s trigger-to-confirm

**Optional accountability beat** (5s, plays at the end of the segment over the same three-row table or a brief "no slashing" badge overlay)

**Voiceover (≈70 words):**
> "Three sponsor integrations, all live on testnet. 0G — five iNFT agents, encrypted on 0G Storage, attested inference on 0G Compute. Gensyn AXL — five separate nodes, cross-ISP verified. KeeperHub — live workflow, point-seven-second payouts. Nineteen out of nineteen integration spikes pass. **We don't slash agents. Rejected work simply doesn't pay — accountability without locked capital.**"

---

### [2:45–2:53] · FUTURE WORK · 8s

**Visual:**
- Three numbered items, big text:
  1. Reverse direction: Base USDC fund → 0G bounty bind
  2. dstack-bound TEE oracle (production verifier)
  3. Reputation-weighted bid pricing (ERC-8004 → bid range)

**Voiceover (≈18 words):**
> "Future work — reverse-direction bounty funding, a production dstack TEE verifier, and reputation-weighted bid pricing on top of ERC-8004."

---

### [2:53–2:58] · CTA · 5s

**Visual:**
- URL: `scholar-swarm.vercel.app` + `github.com/Himess/scholar-swarm`
- Subtitle: `Spike 19 distribute tx · 0xa06717e4…` (clickable in description)

**Voiceover (≈10 words):**
> "All on-chain. All open source. Scholar Swarm. Thanks."

---

## 📊 Total word count: ~395 words across 2:58 ≈ 133 words/min

> **NOTE:** Comfortable, not rushed. Total stays under 0G's "under 3 mins" requirement with 2 seconds of margin. The accountability beat (`We don't slash agents…`) at the end of How It's Made is the strategic positioning vs slashing-based competitors — pre-empts the "no slashing?" objection by reframing it as a deliberate design choice.

---

## 🎤 Recording tips for Semih

1. **One segment at a time.** Don't try to record 3 minutes in one take.
2. **Read slow.** Aim for 130 words/min — that's slower than natural Turkish-speaker English pace.
3. **Re-takes are free.** Best take of each segment.
4. **Sounds to watch:**
   - "**th**" sounds (the, three, throughout) — keep tongue between teeth
   - "**v**" vs "**w**" (verification, with) — bite lower lip for V
   - "**workflow**" (NOT "workshop")
   - Numbers: pronounce digit by digit on critical ones — "zero point seven" not "point seven"
5. **Pauses are good.** A half-second pause between sentences sounds confident, not slow.
6. **Mic position:** ~10 cm from mouth, slightly off-axis (avoid plosives).
7. **Quiet room.** Close windows, turn off fans.

---

## 🚨 Common mistakes to avoid (from ETHGlobal rules)

- ❌ NOT exporting below 720p
- ❌ NOT exceeding 4 minutes
- ❌ NOT speeding up the video
- ❌ NOT using TTS / AI voiceover
- ❌ NOT music with text instead of talking
- ❌ NOT mobile phone recording
- ✅ DO show project in action
- ✅ DO use slides for key points (≤4 bullets per slide)
- ✅ DO speak clearly and at a steady pace
