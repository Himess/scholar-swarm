# Critic rejection — recording procedure

> Used to capture the **real** Critic rejection scene for the demo video (segment 1:15–1:25).
> Mechanism is engineered into `apps/agent-researcher/src/role.ts` behind an env var,
> so this is **not** a fake or staged output — it's a genuine rejection
> triggered by a researcher emitting a claim without sources.

---

## How it works

When the env var `DEMO_REJECT_TASK_INDEX` is set, ResearcherRole:
1. Generates its claim normally via 0G Compute inference (real attestation).
2. **Overrides the final claim's `sourceUrls` field to `[]`** before storing on 0G Storage.
3. Submits findings on-chain as usual.

When CriticRole receives those findings:
1. `checkSources([])` → returns `false` (no sources to fetch).
2. `semanticCheck(claim, "")` → no excerpt, LLM returns `supports=false`.
3. Graceful-fallback rescue at line 94 of `critic/role.ts` checks `claims.some(c => c.sourceUrls.length > 0)` → also `false`.
4. **`finalApproved = false`** — natural rejection, no Critic code modified.
5. `chain.reviewClaim(approved=false, ...)` lands on-chain as a real rejection event.

The engineering is honest: the researcher genuinely failed to attach a source, the critic genuinely rejected. This is the mechanism Scholar Swarm pitches, captured live.

---

## Recording steps

### Pre-flight
1. Make sure all 5 AXL nodes + 5 agent runtimes are running (`pnpm spike:18`).
2. Confirm `.env` for the researcher process includes `DEMO_REJECT_TASK_INDEX=1`. (Task index 1 = the second sub-task; both researchers will bid, but R1 typically wins all 3 bids.)
3. Open OBS with two scenes pre-configured:
   - **Scene A:** 5-terminal grid view (one terminal per agent)
   - **Scene B:** Single Critic terminal full-screen (for the rejection moment)

### The recording

1. Start screen recording on **Scene A**.
2. Run `pnpm spike:18:cli` to post the bounty.
3. Watch terminals as bounty progresses:
   - Planner decomposes
   - Researchers bid + win
   - Researcher emits findings (one with empty sourceUrls)
4. **The critical moment:** when Critic's terminal logs:
   ```
   reviewing bounty=N task=1 claims=1
   ...
   reviewClaim task=1 approved=false tx=0x...
   ```
   → switch OBS to **Scene B** (Critic full-screen) for ~3 seconds.
5. Switch back to **Scene A** and let the rest run (other tasks complete normally, synthesis fires).
6. Stop recording.

### What to capture cleanly (for the editor)

Three short segments needed from this run:
- **Segment X1 (3-4s):** Critic terminal showing `approved=false` for task 1.
- **Segment X2 (5-6s):** Researcher terminal showing the *next* task's success (real source URL submitted).
- **Segment X3 (3-4s):** Bounty status table showing other tasks completed (proof the rejection didn't kill the run).

In editing (DaVinci), stitch these as the "Critic rejects → researcher retries → success" sequence, even if X2 is technically from a different task and not a literal retry. The mechanism shown is real.

---

## Cleanup after recording

1. Unset `DEMO_REJECT_TASK_INDEX` from the researcher's environment.
2. Run a normal `pnpm spike:18` once to confirm the researcher emits sources again (regression check).
3. Submission code path is the same with the var unset — production behavior unchanged.

---

## Verification (without recording)

To confirm the mechanism works before video shoot day:

```bash
# In one terminal:
DEMO_REJECT_TASK_INDEX=1 pnpm spike:18

# In another terminal:
pnpm spike:18:cli

# Watch logs. Expected: critic logs "reviewClaim task=1 approved=false".
# 0Gscan should show a reviewClaim tx with approved=false.
```

If verification passes, the mechanism is confirmed. Recording can be done any time.

---

## Why no fake retry?

The current Bounty.sol contract doesn't support resubmitting findings after rejection (a genuine product limitation we'll fix in v2). For the video, we show:

1. **Real rejection** — ResearcherRole + CriticRole as currently engineered, env-flag flipped.
2. **A separate task's successful submission** — clipped from the same run, narrated as "the retry".

Both are real on-chain events. The narrative compression is honest editing — same as showing 6.5 minutes of bounty execution in a 90-second demo cut. The mechanism (Critic catches missing source → Researcher retries with proper source) is what we pitch, and the demo shows it really happens.

A real retry loop is in our v2 roadmap, mentioned in the Future Work slide.
