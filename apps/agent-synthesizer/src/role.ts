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
  reviewedApproved: Set<number>;
  expectedSubTasks: number;
  bountyAddress?: string;
  bountyIdNum?: bigint;
  fired: boolean;
}

export interface SynthesizerConfig {
  /** How many sub-tasks per bounty (must match Planner). Default 3. */
  expectedSubTasks?: number;
  /** Synthesizer fee in token base units (e.g. 100 USDC = 100_000_000n with 6 decimals). */
  synthFeeBaseUnits?: bigint;
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
  private synthFeeBaseUnits!: bigint;

  constructor(cfg: SynthesizerConfig = {}) {
    super();
    this.expectedSubTasks = cfg.expectedSubTasks ?? 3;
    this.synthFeeBaseUnits = cfg.synthFeeBaseUnits ?? 100_000_000n;
  }

  async handle(msg: SwarmMessage, _sender: string): Promise<void> {
    if (msg.kind === "bounty.broadcast") {
      const bid = msg.bounty.id;
      const acc = this.ensureAcc(bid);
      if (msg.bounty.address) acc.bountyAddress = msg.bounty.address;
      try {
        acc.bountyIdNum = BigInt(bid);
      } catch {
        /* string id, leave undefined */
      }
      return;
    }

    if (msg.kind === "subtask.broadcast") {
      // Planner sends bountyAddress here — cache it for the synth tx later.
      const addr = (msg as any).bountyAddress as string | undefined;
      const acc = this.ensureAcc(msg.bountyId);
      if (addr && !acc.bountyAddress) acc.bountyAddress = addr;
      if (acc.bountyIdNum === undefined) {
        try {
          acc.bountyIdNum = BigInt(msg.bountyId);
        } catch {
          /* string id */
        }
      }
      return;
    }

    if (msg.kind === "findings") {
      this.cacheFinding(msg.findings);
      return;
    }

    if (msg.kind === "review" && msg.review.approved) {
      const acc = this.ensureAcc(msg.review.bountyId);
      acc.reviewedApproved.add(msg.review.subTaskIndex);
      this.log(
        `review approved cached: bounty=${msg.review.bountyId} task=${msg.review.subTaskIndex} ` +
          `(${acc.reviewedApproved.size}/${acc.expectedSubTasks})`,
      );
      // When all sub-tasks are approved, run synthesis + fire LZ on chain.
      if (acc.reviewedApproved.size >= acc.expectedSubTasks && !acc.fired) {
        await this.runFullSynthesis(msg.review.bountyId);
      }
      return;
    }

    if (msg.kind === "synthesis.request") {
      await this.synthesize(msg.bountyId, msg.approvedFindings);
      return;
    }
  }

  private ensureAcc(bountyId: string): BountyAccumulator {
    if (!this.accumulators.has(bountyId)) {
      this.accumulators.set(bountyId, {
        approved: new Map(),
        reviewedApproved: new Set(),
        expectedSubTasks: this.expectedSubTasks,
        fired: false,
      });
    }
    return this.accumulators.get(bountyId)!;
  }

  private cacheFinding(findings: Findings): void {
    const acc = this.ensureAcc(findings.bountyId);
    acc.approved.set(findings.subTaskIndex, findings);
  }

  /**
   * Multi-process flow: synth runs the report and fires LZ V2 atomically
   * via chain.submitSynthesisAndFireLZ. Triggered when all 3 reviews
   * approve.
   */
  private async runFullSynthesis(bountyId: string): Promise<void> {
    const acc = this.accumulators.get(bountyId);
    if (!acc || acc.fired) return;
    acc.fired = true;

    const findings = Array.from(acc.approved.values()).sort((a, b) => a.subTaskIndex - b.subTaskIndex);
    if (findings.length === 0) {
      this.log(`runFullSynthesis: no findings cached for ${bountyId}`);
      acc.fired = false;
      return;
    }

    // Compose report (same as synthesize() below, then anchor on chain).
    const userPrompt = this.composePrompt(bountyId, findings);
    const res = await this.ctx.providers.inference.infer({
      messages: [
        { role: "system", content: SYNTHESIZE_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 1500,
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

    let reportRoot: string | null = null;
    try {
      const ref = await this.ctx.providers.storage.putJSON(report);
      reportRoot = ref.id;
      this.log(`report stored at ${ref.uri ?? ref.id}`);
    } catch (err) {
      this.log(`storage put failed: ${(err as Error).message}`);
      acc.fired = false;
      return;
    }

    // Fire LZ via on-chain submitSynthesis.
    const chain = this.ctx.providers.chain;
    if (chain && acc.bountyAddress && acc.bountyIdNum !== undefined && reportRoot) {
      try {
        const preview = await chain.bountyPreviewPayouts(acc.bountyAddress);
        // previewPayouts is called BEFORE submitSynthesis runs, so it doesn't
        // include the synth entry yet. Append it for the LZ quote — the
        // contract will produce the same final vector.
        const quoteRecipients = [...preview.recipients, this.ctx.operatorWallet];
        const quoteAmounts = [...preview.amounts, this.synthFeeBaseUnits];

        const fee = await chain.quoteSynthesisLzFee(
          acc.bountyAddress,
          acc.bountyIdNum,
          quoteRecipients,
          quoteAmounts,
        );
        this.log(`LZ fee quote: ${fee} wei`);

        const result = await chain.submitSynthesisAndFireLZ(
          acc.bountyAddress,
          BigInt(this.ctx.agentId),
          reportRoot,
          fee,
        );
        this.log(`submitSynthesis tx=${result.txHash} guid=${result.lzGuid ?? "(none)"}`);
      } catch (err) {
        this.log(`submitSynthesis failed: ${(err as Error).message}`);
        acc.fired = false;
        return;
      }
    }

    await this.broadcast({ kind: "report.delivered", report });
    this.log(`report.delivered broadcast for bounty ${bountyId}`);
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
