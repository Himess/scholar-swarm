/**
 * @scholar-swarm/shared
 *
 * Cross-package types + utilities. Distinct from `@scholar-swarm/sdk` which is
 * the public, reusable framework — `shared` is for Scholar-Swarm-specific
 * helpers used by our agent runtimes + frontend.
 */

export const SCHOLAR_SWARM_VERSION = "0.0.1" as const;

/** Opaque branded type for an on-chain agent token id. */
export type AgentId = string & { readonly __brand: "AgentId" };

/** Opaque branded type for a 0G Storage merkle root. */
export type StorageRoot = string & { readonly __brand: "StorageRoot" };

/** Bridge key used to tie a 0G bountyId to its Base PaymentRouter escrow. */
export function bountyKey(bountyId: bigint): `0x${string}` {
  // keccak256-style key. Simple deterministic encoding for now.
  const hex = bountyId.toString(16).padStart(64, "0");
  return `0x${hex}`;
}
