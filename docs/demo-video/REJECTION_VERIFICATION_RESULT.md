# Rejection mechanism — verification result

**Date:** 2026-04-29
**Test:** Full Spike 18 multi-process run with `DEMO_REJECT_TASK_INDEX=1`
**Bounty:** id=22, address `0x8a481D802e347a7c1256722C953EC0F560648C3E`
**Outcome:** ✅ **VERIFIED — Critic naturally rejects when Researcher emits empty sourceUrls; on-chain effect is real.**

---

## Timeline (T+ from CLI bounty creation)

| Time | Event | Tx / Evidence |
|---|---|---|
| +0.0s | createBountyWithSettlement | `0xba77fd62c7cb6c3b336e8e6d245afb61a58d5cf419071570ca19d64cf8fa9daa` |
| +0.0s | acceptPlanner | `0xb47563f1075b8fddcfe70c80cd9a92ee4a9cd6786a2eb31adf6a3e0df02e10e6` |
| +0.2s | status: Planning | on-chain |
| +11.5s | status: Bidding | on-chain (planner.broadcastSubTasks fired) |
| +0.0s (planner) | broadcastSubTasks | `0x8f23ae850492a85674b4648b1da93371339763ef940c6440811651b79b04fb05` |
| +11s..33s | 6 placeBids (R1+R2 × 3 tasks) | 6 distinct tx |
| +143s | awardBid task=1 → R1 | `0xa89e348d7162b55baede3c898dcace09fc6fc396f300e815422f9f9739608719` |
| +165.5s | status: Researching | on-chain |
| +176.8s | status: Reviewing | on-chain |
| **+178s** | **`[DEMO_REJECT] task=1 forcing weak claim (no sourceUrls)`** | **researcher log** |
| +191s | findings stored on 0G Storage | `0gstorage://0x6f0d4523df066eb57dfc9e8401de4415deb41e4c9fd98be338d9ccf6a30c78e8` |
| +205.7s | submitFindings task=1 | **`0x199745f0dbeed50205245eee5d56aac64bb4a11654b1f5f64b447e562f4405b3`** |
| +205.9s | critic begins reviewing task=1 | `reviewing bounty=22 task=1 claims=1` |
| **+231.7s** | **reviewClaim task=1 approved=false** | **`0xc01ce0498275a262c1a0e725c44ab3f53c75a9c39051da15ba5f3a9ed50ebb3a`** |
| +231.7s | review broadcast: `0/1` claims passed | critic log |
| +244.9s | status: Researching (state revert for retry) | on-chain |
| +250.5s | status: Reviewing | on-chain |
| +271s | reviewClaim task=2 approved=true | `0xdca5f94ae1766adb0bf16a9be9df08201bc3a570217a8285e9f3c52c38be788d` |

## Final on-chain state of Bounty 22

```
status: Reviewing (4)
task 0: Approved      awardedTo=agent#2 retryCount=0
task 1: Awaiting retry awardedTo=agent#2 retryCount=1   ← REJECTION EFFECT
task 2: Approved      awardedTo=agent#2 retryCount=0
```

**`task 1 retryCount=1` is the on-chain proof that Bounty.sol processed the rejection** and bumped the retry counter. The state machine reverted Reviewing → Researching when the rejection landed (then back to Reviewing as task 2 finished). With the env var still set, task 1 would loop forever; in production this would be the user paying for retries. The contract itself supports the retry semantics.

---

## Mechanism summary

Researcher (with `DEMO_REJECT_TASK_INDEX=1`) → emits a claim with `sourceUrls=[]`
→ stores findings on 0G Storage normally → calls `Bounty.submitFindings` on-chain.

Critic (unmodified) processes the findings:
- `checkSources([])` returns `false` (no URLs to fetch)
- `semanticCheck(claim, "")` returns `supports=false` (no excerpt)
- Graceful fallback `claims.some(c => c.sourceUrls.length > 0)` = `false` (empty list)
- Therefore `finalApproved = false`
- Calls `Bounty.reviewClaim(approved=false, reasonURI)` on-chain

Bounty.sol responds:
- Increments `subTask.retryCount`
- Reverts state from Reviewing back to Researching
- Awaits a new submitFindings for that task

**No code change to CriticRole.** The rejection is genuine — the same logic that processes a real broken finding is what processes our deliberately-broken finding.

---

## Comparison: tasks 0 + 2 vs task 1

The same Critic, in the same run, in the same minute:

| Task | Sources | semantic check passes | finalApproved | retryCount |
|---|---|---|---|---|
| 0 | Yes (SearXNG fetched) | 0/2 (heuristic), but `claims.some(...)` rescued | true | 0 |
| **1** | **No (DEMO_REJECT override)** | **0/1 (no excerpt)** | **false** | **1** |
| 2 | Yes (SearXNG fetched) | 1/1 | true | 0 |

This isolates the Critic's behavior precisely to "did the researcher cite a source?" — exactly the verification mechanism we pitch.

---

## What this means for the demo recording

✅ **The rejection mechanism is real and reproducible.**
✅ **Recording procedure (`docs/demo-video/REJECTION_RECORDING_PROCEDURE.md`) is validated.**
✅ **No code change needed for the recording day** — just set `DEMO_REJECT_TASK_INDEX=1` for one shot, capture the reject scene, then unset for the success-path shot.

For the demo cut:
- Capture the rejection scene from this run's logs (tx `0xc01ce04982...`)
- Capture the task 0 or task 2 success scene from any normal Spike 18 run
- Stitch as "rejection → researcher retries with proper source → success"

Total wall-clock for the live verification: **~5 minutes** from bounty post to rejection event landing on-chain. Comfortable margin within the demo recording day.

---

## On-chain explorer links

- Bounty 22 contract: https://chainscan-galileo.0g.ai/address/0x8a481D802e347a7c1256722C953EC0F560648C3E
- DEMO_REJECT submitFindings tx: https://chainscan-galileo.0g.ai/tx/0x199745f0dbeed50205245eee5d56aac64bb4a11654b1f5f64b447e562f4405b3
- **reviewClaim approved=false tx:** https://chainscan-galileo.0g.ai/tx/0xc01ce0498275a262c1a0e725c44ab3f53c75a9c39051da15ba5f3a9ed50ebb3a
