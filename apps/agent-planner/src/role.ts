/**
 * PlannerRole — receives bounty broadcasts, decomposes into 3 sub-tasks
 * via attested LLM inference, broadcasts sub-tasks, collects bids,
 * selects winners by reputation-weighted score, broadcasts awards.
 */

import { Role } from "@scholar-swarm/sdk";
import type { Bid, Bounty, RoleId, SwarmMessage } from "@scholar-swarm/sdk";

interface BountyState {
  bounty: Bounty;
  subTasks: string[];
  bids: Bid[][]; // per-subtask
  awarded: (string | null)[]; // agentId per subtask
  bidWindowOpen: boolean;
  attestation: unknown; // 0G Compute attestation for the decomposition
}

export interface PlannerConfig {
  /** Bid window in ms before awarding. */
  bidWindowMs?: number;
  /** Hard cap on sub-tasks. Currently fixed to 3 for MVP. */
  subTaskCount?: number;
}

const DECOMPOSE_SYSTEM = `You are the Planner agent in a multi-agent research swarm.
Your job: break a research goal into exactly 3 specific, non-overlapping sub-questions a researcher can answer with web sources.
Return ONLY a JSON array of 3 strings, no prose.`;

export class PlannerRole extends Role {
  readonly id: RoleId = "planner";

  private bounties = new Map<string, BountyState>();
  private bidWindowMs: number;
  private subTaskCount: number;

  constructor(cfg: PlannerConfig = {}) {
    super();
    this.bidWindowMs = cfg.bidWindowMs ?? 30_000;
    this.subTaskCount = cfg.subTaskCount ?? 3;
  }

  async handle(msg: SwarmMessage, _sender: string): Promise<void> {
    switch (msg.kind) {
      case "bounty.broadcast":
        await this.onBountyBroadcast(msg.bounty);
        return;
      case "bid":
        this.onBid(msg.bid);
        return;
      default:
        return; // ignore others
    }
  }

  private async onBountyBroadcast(bounty: Bounty): Promise<void> {
    if (this.bounties.has(bounty.id)) return; // idempotent
    this.log(`accepting bounty ${bounty.id}: "${bounty.goal.slice(0, 80)}"`);

    const { subTasks, attestation } = await this.decompose(bounty);
    this.log(`decomposed into ${subTasks.length} sub-tasks`);

    this.bounties.set(bounty.id, {
      bounty,
      subTasks,
      bids: subTasks.map(() => []),
      awarded: subTasks.map(() => null),
      bidWindowOpen: true,
      attestation,
    });

    for (let i = 0; i < subTasks.length; ++i) {
      const subTaskItem = subTasks[i];
      if (!subTaskItem) continue;
      await this.broadcast({
        kind: "subtask.broadcast",
        bountyId: bounty.id,
        subTaskIndex: i,
        description: subTaskItem,
      });
    }

    setTimeout(() => {
      this.awardAll(bounty.id).catch((e: Error) =>
        this.log(`awardAll error for ${bounty.id}: ${e.message}`),
      );
    }, this.bidWindowMs);
  }

  private onBid(bid: Bid): void {
    const state = this.bounties.get(bid.bountyId);
    if (!state || !state.bidWindowOpen) return;
    if (bid.subTaskIndex >= state.bids.length) return;
    state.bids[bid.subTaskIndex]!.push(bid);
    this.log(`bid: agent=${bid.agentId} task=${bid.subTaskIndex} price=${bid.priceUnits}`);
  }

  private async awardAll(bountyId: string): Promise<void> {
    const state = this.bounties.get(bountyId);
    if (!state) return;
    state.bidWindowOpen = false;

    for (let i = 0; i < state.bids.length; ++i) {
      const winner = this.pickWinner(state.bids[i] ?? []);
      if (!winner) {
        this.log(`no bids for sub-task ${i} — bounty ${bountyId} stuck`);
        continue;
      }
      state.awarded[i] = winner.agentId;
      await this.broadcast({
        kind: "bid.awarded",
        bountyId,
        subTaskIndex: i,
        agentId: winner.agentId,
        priceUnits: winner.priceUnits,
      });
      this.log(`awarded sub-task ${i} → agent ${winner.agentId} @ ${winner.priceUnits}`);
    }
  }

  /** Reputation-weighted selection. Tie-break: lower price. */
  private pickWinner(bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    const scored = bids.map((b) => ({
      bid: b,
      // score: rep is dominant; price acts as a small tiebreak (lower better).
      score: b.reputationSnapshot * 1_000_000 - Number(b.priceUnits),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.bid;
  }

  private async decompose(bounty: Bounty): Promise<{ subTasks: string[]; attestation: unknown }> {
    const res = await this.ctx.providers.inference.infer({
      messages: [
        { role: "system", content: DECOMPOSE_SYSTEM },
        {
          role: "user",
          content: `Goal: ${bounty.goal}\n\nReturn 3 sub-questions as a JSON array.`,
        },
      ],
      temperature: 0.2,
    });
    const subTasks = parseJSONArrayOf3(res.content) ?? [
      `${bounty.goal} — context and background`,
      `${bounty.goal} — key entities and constraints`,
      `${bounty.goal} — risks and unknowns`,
    ];
    return { subTasks, attestation: res.attestation };
  }
}

function parseJSONArrayOf3(text: string): string[] | null {
  // Some models wrap output in ```json fences or prose. Extract the first JSON array.
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]) as unknown[];
    if (Array.isArray(arr) && arr.every((s) => typeof s === "string")) {
      return arr.slice(0, 3) as string[];
    }
  } catch {
    /* fall through */
  }
  return null;
}
