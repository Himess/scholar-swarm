# AI Collaboration Artifacts

This folder is the audit trail for ETHGlobal's AI usage requirement: **AI tools assist; the human contributes meaningfully.** Every architectural decision, scope change, and pivot in Scholar Swarm has a human author. AI helped accelerate execution.

## What's here

| File | Author | Purpose |
|---|---|---|
| [`PROJECT_BRIEF_v1.md`](./PROJECT_BRIEF_v1.md) | Semih (with Claude Web brainstorm) | Initial project brief — wrote before this repo existed |
| [`PROJECT_BRIEF_v2.md`](./PROJECT_BRIEF_v2.md) | Semih (revised after Claude Code feedback) | Locked-in brief — what got built |
| [`claude-code-feedback-v1.md`](./claude-code-feedback-v1.md) | Claude Code (recorded by Semih) | Honest critique of v1 brief — red flags, scope risks |
| [`claude-code-feedback-v2.md`](./claude-code-feedback-v2.md) | Claude Code (recorded by Semih) | Acknowledgment of v2 fixes + remaining concerns |
| [`decision-log.md`](./decision-log.md) | **Semih** | Architectural decisions — why each was made, by whom |
| [`day-by-day-notes.md`](./day-by-day-notes.md) | Semih (chronological summary) | What happened each day, what blocked, what unblocked |
| [`conversation-log.md`](./conversation-log.md) | Semih (narrative, post-hoc edited) | Substance of major design discussions with Claude Code — pivots, debugging, trade-offs |

## How AI was used

- **Claude Web (claude.ai)** — brainstorm partner for project selection, pitch refinement, scope decisions, and submission strategy. Used for ~6-8 hours total across Days -2 to 7. Did not write code.
- **Claude Code (this CLI)** — pair-programmer for implementation. Wrote scaffolding, contract iterations, spike scripts, and adapter packages under the human's direction. Every commit was reviewed before push.
- **Cursor / VS Code IDE** — Semih's primary editor. AI completion turned ON for boilerplate.

## What the human did (not AI)

1. **Project selection.** Picked Scholar Swarm over 6+ alternatives (VARdict, AgentDeal, Encrypted Deliverable, etc.) after a 4-hour brainstorm. AI presented options; the choice was Semih's. ([decision-log.md D1](./decision-log.md))
2. **Sponsor track choices.** 0G Labs (dual track), Gensyn AXL, KeeperHub. Each picked based on technical fit + prize pool ROI analysis Semih ran personally.
3. **Architecture pivots that AI did NOT propose:**
   - Dropping the trusted-relayer design in favor of LayerZero V2 ([D3](./decision-log.md))
   - Refactoring `Bounty.submitSynthesis` to be `payable` and atomically fire LZ ([D4](./decision-log.md))
   - Including ERC-7857 iNFTs in MVP scope despite implementation cost ([D2](./decision-log.md))
   - Story-first README structure ("AutoGPT for serious research" hook) over buzzword-list ([D5](./decision-log.md))
4. **Debug sessions.** When `submitSynthesis` reverted with `Transfer_NativeFailed`, Semih traced the root cause (LZ V2 OApp `_payNative` strict equality requirement) and chose the fix (send exact `nativeFee`, no buffer) instead of the obvious-but-wrong fix (add `receive()` payable to Bounty). AI executed the change.
5. **Operational decisions.** When operator wallets ran out of OG mid-run, Semih chose to top up + re-run rather than redesigning the test. When the messenger ownership got locked to old Factory, Semih chose to redeploy V2 + transfer ownership rather than upgrade-pattern complexity.

## What AI did (under human direction)

- Generated initial scaffold (Day 0-3 work — labeled honestly in commit `0e7e8b2`).
- Wrote first drafts of contract files, then iterated based on Foundry test failures + Semih's review comments.
- Wrote spike scripts following the pattern Semih established in Spike 1.
- Wrote adapter packages (og-client, axl-client, keeperhub-client, mcp-tools) using the interface Semih designed in `swarm-sdk/src/providers.ts`.
- Wrote README sections that Semih then edited for tone/positioning.
- Authored deploy scripts; Semih ran them and verified on-chain results.

## Why this folder exists

ETHGlobal's submission rules (April 2026) specify:

> AI tools should be used to assist, not create the entire project. Spec-driven workflows must include all spec files, prompts, and planning artifacts.

This folder is our compliance with both clauses.
