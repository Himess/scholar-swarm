/**
 * @scholar-swarm/sdk — shared types
 *
 * Domain-agnostic primitives for building multi-agent verifiable workflows.
 * The SDK does NOT depend on Scholar Swarm specifics — Scholar Swarm is a
 * REFERENCE implementation built on top.
 */

import { z } from "zod";

/** Role identifier. Standard roles ship; custom roles work too. */
export const StandardRole = {
  Planner: "planner",
  Worker: "worker",
  Critic: "critic",
  Synthesizer: "synthesizer",
} as const;

export type StandardRoleId = (typeof StandardRole)[keyof typeof StandardRole];
export type RoleId = StandardRoleId | string;

/** Bid envelope when workers compete for sub-tasks. */
export const BidSchema = z.object({
  bountyId: z.string(),
  subTaskIndex: z.number().int().min(0),
  agentId: z.string(),
  agentRole: z.string(),
  priceUnits: z.string(), // bigint as decimal string
  reputationSnapshot: z.number().int().min(0),
  submittedAt: z.number().int(),
});
export type Bid = z.infer<typeof BidSchema>;

/** A single claim with source attribution — the unit of verifiable research output. */
export const ClaimSchema = z.object({
  text: z.string(),
  sourceUrls: z.array(z.string().url()),
  excerpts: z.array(z.string()),
  confidence: z.number().min(0).max(1).optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Findings payload — what a worker submits per sub-task. */
export const FindingsSchema = z.object({
  bountyId: z.string(),
  subTaskIndex: z.number().int().min(0),
  workerAgentId: z.string(),
  claims: z.array(ClaimSchema).min(1),
  reasoningTrace: z.string().optional(),
  attestation: z.unknown(),
});
export type Findings = z.infer<typeof FindingsSchema>;

/** Critic decision. */
export const ReviewSchema = z.object({
  bountyId: z.string(),
  subTaskIndex: z.number().int().min(0),
  criticAgentId: z.string(),
  approved: z.boolean(),
  reasonURI: z.string().optional(),
  perClaimVerdicts: z
    .array(
      z.object({
        claimIndex: z.number().int().min(0),
        sourceFetchedOk: z.boolean(),
        semanticMatch: z.boolean(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  attestation: z.unknown(),
});
export type Review = z.infer<typeof ReviewSchema>;

/** Bounty descriptor as stored on-chain + storage. */
export const BountySchema = z.object({
  id: z.string(),
  user: z.string(),
  goal: z.string(),
  budgetUnits: z.string(), // bigint as decimal string
  subTasks: z.array(z.string()).min(1),
  storageRoot: z.string().optional(),
});
export type Bounty = z.infer<typeof BountySchema>;

/** Final synthesized report. */
export const ReportSchema = z.object({
  bountyId: z.string(),
  synthesizerAgentId: z.string(),
  body: z.string(),
  citations: z.array(
    z.object({
      claimText: z.string(),
      sourceUrls: z.array(z.string().url()),
      contributedBy: z.string(),
    }),
  ),
  attestation: z.unknown(),
});
export type Report = z.infer<typeof ReportSchema>;

/** Generic message envelope traveling on the messaging provider. */
export type SwarmMessage =
  | { kind: "bounty.broadcast"; bounty: Bounty }
  | { kind: "subtask.broadcast"; bountyId: string; subTaskIndex: number; description: string }
  | { kind: "bid"; bid: Bid }
  | { kind: "bid.awarded"; bountyId: string; subTaskIndex: number; agentId: string; priceUnits: string }
  | { kind: "findings"; findings: Findings }
  | { kind: "review"; review: Review }
  | { kind: "synthesis.request"; bountyId: string; approvedFindings: Findings[] }
  | { kind: "report.delivered"; report: Report };
