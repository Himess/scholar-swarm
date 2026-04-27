/**
 * ResearcherRole — bids on sub-tasks, performs retrieval-augmented research
 * with attested inference, stores findings on 0G Storage, broadcasts results.
 *
 * Bidding strategy: lower price for high-rep agents, higher price for new ones.
 * Single agent can win multiple sub-tasks per bounty (Scholar Swarm explicitly
 * allows this — see PLAN.md §3.1).
 */

import { Role } from "@scholar-swarm/sdk";
import type { Claim, Findings, RoleId, SwarmMessage } from "@scholar-swarm/sdk";

export interface ResearcherConfig {
  /** Base price per sub-task in token units. */
  basePriceUnits?: string;
  /** Reputation score we report when bidding. Pre-seeded for demo. */
  reputationSnapshot?: number;
  /** Skip bidding if our existing wins on this bounty exceed this cap. */
  maxConcurrentTasks?: number;
}

const RESEARCH_SYSTEM = `You are a Researcher agent in Scholar Swarm.
Given a sub-question and (optionally) a list of source excerpts, produce
research claims grounded in the sources. Each claim must cite at least one
source URL and quote a relevant excerpt.

Return ONLY valid JSON of shape:
{
  "claims": [
    { "text": "...", "sourceUrls": ["https://..."], "excerpts": ["..."], "confidence": 0.0..1.0 }
  ],
  "reasoningTrace": "brief paragraph"
}

If no sources are provided, still return claims based on training knowledge,
but mark confidence ≤ 0.6 and use sourceUrls=[].`;

export class ResearcherRole extends Role {
  readonly id: RoleId = "researcher";

  // Per-bounty: our awarded sub-tasks. agentId here is OUR agentId.
  private myAwarded = new Map<string, Set<number>>();

  private basePriceUnits: bigint;
  private reputationSnapshot: number;
  private maxConcurrentTasks: number;

  constructor(cfg: ResearcherConfig = {}) {
    super();
    this.basePriceUnits = BigInt(cfg.basePriceUnits ?? "200000000"); // 200 USDC (6dec) by default
    this.reputationSnapshot = cfg.reputationSnapshot ?? 0;
    this.maxConcurrentTasks = cfg.maxConcurrentTasks ?? 3;
  }

  async handle(msg: SwarmMessage, _sender: string): Promise<void> {
    switch (msg.kind) {
      case "subtask.broadcast":
        await this.onSubTaskBroadcast(msg.bountyId, msg.subTaskIndex, msg.description);
        return;
      case "bid.awarded":
        if (msg.agentId === this.ctx.agentId) {
          await this.onAwardedToMe(msg.bountyId, msg.subTaskIndex);
        }
        return;
      default:
        return;
    }
  }

  // bountyId+subTaskIndex → the sub-question text. Cached on broadcast so we
  // can use the actual question text as the retrieval query when awarded.
  private subTaskDescriptions = new Map<string, string>();

  private async onSubTaskBroadcast(bountyId: string, subTaskIndex: number, desc: string): Promise<void> {
    this.subTaskDescriptions.set(`${bountyId}:${subTaskIndex}`, desc);

    const wins = this.myAwarded.get(bountyId)?.size ?? 0;
    if (wins >= this.maxConcurrentTasks) return; // already loaded

    const price = this.computePrice();
    await this.broadcast({
      kind: "bid",
      bid: {
        bountyId,
        subTaskIndex,
        agentId: this.ctx.agentId,
        agentRole: "researcher",
        priceUnits: price.toString(),
        reputationSnapshot: this.reputationSnapshot,
        submittedAt: Date.now(),
      },
    });
    this.log(`bid placed: bounty=${bountyId} task=${subTaskIndex} price=${price}`);
  }

  private async onAwardedToMe(bountyId: string, subTaskIndex: number): Promise<void> {
    if (!this.myAwarded.has(bountyId)) this.myAwarded.set(bountyId, new Set());
    this.myAwarded.get(bountyId)!.add(subTaskIndex);
    this.log(`awarded sub-task ${subTaskIndex} on bounty ${bountyId} — starting research`);

    try {
      const findings = await this.research(bountyId, subTaskIndex);
      await this.broadcast({ kind: "findings", findings });
      this.log(`findings published — ${findings.claims.length} claims`);
    } catch (err) {
      this.log(`research failed: ${(err as Error).message}`);
    }
  }

  private async research(bountyId: string, subTaskIndex: number): Promise<Findings> {
    const subQuestion =
      this.subTaskDescriptions.get(`${bountyId}:${subTaskIndex}`) ??
      `bounty ${bountyId} task ${subTaskIndex}`;

    // 1. Retrieval (optional). If RetrievalProvider is wired, fetch sources
    //    using the actual sub-question text. Otherwise fall back to model
    //    knowledge with low-confidence claims.
    let sourceContext = "";
    const retrieval = this.ctx.providers.retrieval;
    if (retrieval) {
      try {
        const results = await retrieval.search(subQuestion, { maxResults: 5 });
        sourceContext = results
          .map((r, i) => `Source ${i + 1}: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.slice(0, 800)}`)
          .join("\n\n");
        this.log(`retrieval ok: ${results.length} sources for "${subQuestion.slice(0, 60)}…"`);
      } catch (err) {
        this.log(`retrieval failed, falling back to model knowledge: ${(err as Error).message}`);
      }
    }

    // 2. Inference — attested via 0G Compute.
    const userPrompt = sourceContext
      ? `Sub-question: ${subQuestion}\n\nSources:\n${sourceContext}\n\nProduce JSON claims.`
      : `Sub-question: ${subQuestion}\n\nNo retrieval available. Use training knowledge. Mark confidence ≤ 0.6.`;
    const res = await this.ctx.providers.inference.infer({
      messages: [
        { role: "system", content: RESEARCH_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    const parsed = parseClaims(res.content) ?? {
      claims: [
        {
          text: `Researcher could not parse model output for bounty ${bountyId} task ${subTaskIndex}.`,
          sourceUrls: [],
          excerpts: [],
          confidence: 0.1,
        },
      ],
      reasoningTrace: res.content.slice(0, 500),
    };

    // 3. Store findings on 0G Storage if available.
    const findingsBody: Findings = {
      bountyId,
      subTaskIndex,
      workerAgentId: this.ctx.agentId,
      claims: parsed.claims,
      reasoningTrace: parsed.reasoningTrace ?? "",
      attestation: res.attestation,
    };
    try {
      const ref = await this.ctx.providers.storage.putJSON(findingsBody);
      this.log(`findings stored at ${ref.uri ?? ref.id}`);
    } catch (err) {
      this.log(`storage put failed (continuing): ${(err as Error).message}`);
    }

    return findingsBody;
  }

  private computePrice(): bigint {
    // Higher reputation = lower price floor (we can afford to underbid).
    if (this.reputationSnapshot >= 10) return this.basePriceUnits - this.basePriceUnits / 5n;
    if (this.reputationSnapshot >= 4) return this.basePriceUnits - this.basePriceUnits / 10n;
    return this.basePriceUnits;
  }
}

function parseClaims(text: string): { claims: Claim[]; reasoningTrace?: string } | null {
  // Extract first JSON object from possibly-fenced model output.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as { claims?: unknown; reasoningTrace?: unknown };
    if (!Array.isArray(obj.claims)) return null;
    const claims: Claim[] = [];
    for (const c of obj.claims as unknown[]) {
      const co = c as Record<string, unknown>;
      if (typeof co["text"] !== "string") continue;
      const claim: Claim = {
        text: co["text"],
        sourceUrls: Array.isArray(co["sourceUrls"]) ? (co["sourceUrls"] as string[]) : [],
        excerpts: Array.isArray(co["excerpts"]) ? (co["excerpts"] as string[]) : [],
      };
      if (typeof co["confidence"] === "number") claim.confidence = co["confidence"];
      claims.push(claim);
    }
    if (claims.length === 0) return null;
    return {
      claims,
      reasoningTrace: typeof obj.reasoningTrace === "string" ? obj.reasoningTrace : undefined,
    };
  } catch {
    return null;
  }
}
