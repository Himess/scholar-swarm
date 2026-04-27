/**
 * SynthesizerRole — waits for all critic-approved findings on a bounty,
 * reads them from 0G Storage, runs an attested LLM synthesis, stores the
 * final report on 0G, broadcasts `report.delivered`.
 *
 * Triggers when ALL sub-tasks for a bounty have a `review.approved=true`.
 * Tracks state per-bounty to know when the swarm is done.
 */

import { Role } from "@scholar-swarm/sdk";
import type { Findings, Report, RoleId, SwarmMessage } from "@scholar-swarm/sdk";

interface BountyAccumulator {
  approved: Map<number, Findings>;
  expectedSubTasks: number;
}

export interface SynthesizerConfig {
  /** How many sub-tasks per bounty (must match Planner). Default 3. */
  expectedSubTasks?: number;
}

const SYNTHESIZE_SYSTEM = `You are the Synthesizer agent in Scholar Swarm.
You receive several critic-approved Findings JSON blobs for one research goal.
Produce a final report that integrates all findings into a coherent narrative.

Constraints:
- Each statement must trace back to one of the input claims (cite by URL).
- If sources disagree, say so explicitly.
- Do not invent facts. Stay within what the inputs assert.
- Tone: precise, neutral, dense — this is a paid analyst report.

Return ONLY JSON:
{
  "body": "...markdown report...",
  "citations": [
    { "claimText": "...", "sourceUrls": ["https://..."], "contributedBy": "researcher-agent-id" }
  ]
}`;

export class SynthesizerRole extends Role {
  readonly id: RoleId = "synthesizer";

  private accumulators = new Map<string, BountyAccumulator>();
  private expectedSubTasks: number;

  constructor(cfg: SynthesizerConfig = {}) {
    super();
    this.expectedSubTasks = cfg.expectedSubTasks ?? 3;
  }

  async handle(msg: SwarmMessage, _sender: string): Promise<void> {
    if (msg.kind === "review" && msg.review.approved) {
      // Pair the review with the findings via a separate findings cache. Simplest:
      // request from the bus by listening for findings too.
      // For Phase 3 we trigger synthesis when the bus announces approved
      // findings via "synthesis.request" coming from the Critic, OR when we've
      // accumulated findings from "findings" messages and reviews approved them.
      return; // we react to synthesis.request below
    }

    if (msg.kind === "findings") {
      this.cacheFinding(msg.findings);
      return;
    }

    if (msg.kind === "synthesis.request") {
      await this.synthesize(msg.bountyId, msg.approvedFindings);
      return;
    }
  }

  private cacheFinding(findings: Findings): void {
    if (!this.accumulators.has(findings.bountyId)) {
      this.accumulators.set(findings.bountyId, {
        approved: new Map(),
        expectedSubTasks: this.expectedSubTasks,
      });
    }
    // We don't approve here — Critic's role. Just remember the findings so when
    // we're handed an explicit synthesis.request we have the body ready.
    this.accumulators.get(findings.bountyId)!.approved.set(findings.subTaskIndex, findings);
  }

  private async synthesize(bountyId: string, approvedFindings: Findings[]): Promise<void> {
    if (approvedFindings.length === 0) {
      this.log(`synthesize called with no findings for bounty ${bountyId}`);
      return;
    }
    this.log(`synthesizing report for bounty ${bountyId} from ${approvedFindings.length} findings`);

    const userPrompt = this.composePrompt(bountyId, approvedFindings);
    const res = await this.ctx.providers.inference.infer({
      messages: [
        { role: "system", content: SYNTHESIZE_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 2000,
    });

    const parsed = parseReportJSON(res.content) ?? {
      body: res.content,
      citations: [],
    };

    const report: Report = {
      bountyId,
      synthesizerAgentId: this.ctx.agentId,
      body: parsed.body,
      citations: parsed.citations,
      attestation: res.attestation,
    };

    try {
      const ref = await this.ctx.providers.storage.putJSON(report);
      this.log(`report stored at ${ref.uri ?? ref.id}`);
    } catch (err) {
      this.log(`storage put failed (continuing): ${(err as Error).message}`);
    }

    await this.broadcast({ kind: "report.delivered", report });
    this.log(`report.delivered broadcast for bounty ${bountyId}`);
  }

  private composePrompt(bountyId: string, findings: Findings[]): string {
    const parts: string[] = [`Research bounty: ${bountyId}`, `Number of approved findings: ${findings.length}`];
    for (const f of findings) {
      parts.push(`\n--- sub-task ${f.subTaskIndex} (researcher ${f.workerAgentId}) ---`);
      for (const c of f.claims) {
        const sources = c.sourceUrls.length > 0 ? c.sourceUrls.join(", ") : "(no source)";
        parts.push(`• ${c.text}\n  sources: ${sources}\n  confidence: ${c.confidence ?? "n/a"}`);
      }
    }
    parts.push("\nProduce a synthesized JSON report per the system prompt schema.");
    return parts.join("\n");
  }
}

function parseReportJSON(text: string): { body: string; citations: Report["citations"] } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as { body?: unknown; citations?: unknown };
    if (typeof obj.body !== "string") return null;
    const citations = Array.isArray(obj.citations)
      ? (obj.citations as unknown[])
          .map((c) => {
            const co = c as Record<string, unknown>;
            if (typeof co["claimText"] !== "string") return null;
            return {
              claimText: co["claimText"],
              sourceUrls: Array.isArray(co["sourceUrls"]) ? (co["sourceUrls"] as string[]) : [],
              contributedBy: typeof co["contributedBy"] === "string" ? co["contributedBy"] : "",
            };
          })
          .filter((x): x is { claimText: string; sourceUrls: string[]; contributedBy: string } => x !== null)
      : [];
    return { body: obj.body, citations };
  } catch {
    return null;
  }
}
