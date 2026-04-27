/**
 * CriticRole — verifies researcher findings claim-by-claim.
 *
 * For each claim:
 *  1. Fetch each `sourceUrl` over HTTPS (existence + availability).
 *  2. Run a separate attested LLM inference: "Does this excerpt support this claim?"
 *  3. Aggregate per-claim verdicts into a sub-task approval.
 *
 * Approve if ≥ 2/3 of claims pass both checks (configurable threshold).
 * Otherwise reject with a structured rationale stored on 0G Storage.
 */

import { Role } from "@scholar-swarm/sdk";
import type { Findings, Review, RoleId, SwarmMessage } from "@scholar-swarm/sdk";

export interface CriticConfig {
  /** Fraction of claims that must pass to approve. */
  approvalThreshold?: number;
  /** HTTP timeout for source fetches (ms). */
  fetchTimeoutMs?: number;
  /** Skip URL fetch on these schemes. */
  skipSchemes?: string[];
}

const SEMANTIC_SYSTEM = `You are the Critic agent in Scholar Swarm.
You receive: a claim made by a Researcher and an excerpt from a source URL.
Decide ONLY whether the excerpt directly supports the claim.

Return ONLY JSON: { "supports": true|false, "rationale": "one sentence why" }.
Be strict. If the excerpt is empty, off-topic, or doesn't actually support the
claim, return false even if the claim sounds plausible.`;

export class CriticRole extends Role {
  readonly id: RoleId = "critic";

  private threshold: number;
  private fetchTimeoutMs: number;

  constructor(cfg: CriticConfig = {}) {
    super();
    this.threshold = cfg.approvalThreshold ?? 0.66;
    this.fetchTimeoutMs = cfg.fetchTimeoutMs ?? 8000;
  }

  async handle(msg: SwarmMessage, _sender: string): Promise<void> {
    if (msg.kind !== "findings") return;
    await this.review(msg.findings);
  }

  private async review(findings: Findings): Promise<void> {
    this.log(`reviewing bounty=${findings.bountyId} task=${findings.subTaskIndex} claims=${findings.claims.length}`);

    const verdicts: Review["perClaimVerdicts"] = [];
    let passed = 0;
    let totalChecked = 0;

    for (let i = 0; i < findings.claims.length; ++i) {
      const claim = findings.claims[i]!;
      const fetchOk = await this.checkSources(claim.sourceUrls);
      const semanticOk = await this.semanticCheck(claim.text, claim.excerpts.join("\n\n"));
      verdicts!.push({
        claimIndex: i,
        sourceFetchedOk: fetchOk,
        semanticMatch: semanticOk.supports,
        notes: semanticOk.rationale,
      });
      totalChecked += 1;
      if (fetchOk && semanticOk.supports) passed += 1;
    }

    const approved = totalChecked === 0 ? false : passed / totalChecked >= this.threshold;
    const reasonURI = await this.storeRationale(findings, verdicts!, approved);

    const review: Review = {
      bountyId: findings.bountyId,
      subTaskIndex: findings.subTaskIndex,
      criticAgentId: this.ctx.agentId,
      approved,
      perClaimVerdicts: verdicts,
      attestation: { criticDecision: approved, claimsChecked: totalChecked },
    };
    if (reasonURI) review.reasonURI = reasonURI;

    await this.broadcast({ kind: "review", review });
    this.log(`review broadcast: bounty=${findings.bountyId} task=${findings.subTaskIndex} approved=${approved} (${passed}/${totalChecked})`);
  }

  private async checkSources(urls: string[]): Promise<boolean> {
    if (urls.length === 0) return false; // no sources cited
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.fetchTimeoutMs);
        const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok && res.status !== 405) {
          // Some servers reject HEAD; try GET.
          const ctrl2 = new AbortController();
          const timer2 = setTimeout(() => ctrl2.abort(), this.fetchTimeoutMs);
          const res2 = await fetch(url, { method: "GET", signal: ctrl2.signal });
          clearTimeout(timer2);
          if (!res2.ok) return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  }

  private async semanticCheck(claim: string, excerpt: string): Promise<{ supports: boolean; rationale: string }> {
    const userPrompt = excerpt
      ? `Claim: ${claim}\n\nExcerpt: ${excerpt}\n\nDoes the excerpt directly support the claim?`
      : `Claim: ${claim}\n\nNo excerpt was provided. Therefore the claim is NOT source-supported.`;
    try {
      const res = await this.ctx.providers.inference.infer({
        messages: [
          { role: "system", content: SEMANTIC_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      });
      const match = res.content.match(/\{[\s\S]*\}/);
      if (!match) return { supports: false, rationale: "no JSON in critic output" };
      const parsed = JSON.parse(match[0]) as { supports?: unknown; rationale?: unknown };
      return {
        supports: parsed.supports === true,
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : "no rationale",
      };
    } catch (err) {
      return { supports: false, rationale: `inference error: ${(err as Error).message}` };
    }
  }

  private async storeRationale(
    findings: Findings,
    verdicts: NonNullable<Review["perClaimVerdicts"]>,
    approved: boolean,
  ): Promise<string | null> {
    try {
      const ref = await this.ctx.providers.storage.putJSON({
        bountyId: findings.bountyId,
        subTaskIndex: findings.subTaskIndex,
        criticAgentId: this.ctx.agentId,
        approved,
        verdicts,
        timestamp: Date.now(),
      });
      return ref.uri ?? `0gstorage://${ref.id}`;
    } catch {
      return null;
    }
  }
}
