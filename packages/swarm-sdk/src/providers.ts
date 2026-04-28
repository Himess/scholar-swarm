/**
 * Pluggable provider interfaces. Concrete adapters live in `./adapters/`.
 *
 * Design principle: an Agent is composed of providers. Swap any provider
 * with a different impl (TEE inference vs OpenAI; 0G Storage vs IPFS;
 * AXL vs WebSocket; KeeperHub vs raw signer) and the agent code is
 * unchanged. This is what makes Scholar Swarm a *framework* not a tool.
 */

import type { SwarmMessage } from "./types.js";

// ─────────────────────────────────────────────────────────────
//  Inference
// ─────────────────────────────────────────────────────────────

export interface InferenceMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface InferenceRequest {
  messages: InferenceMessage[];
  model?: string;
  tools?: ReadonlyArray<unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface AttestedResponse {
  /** The model's text output. */
  content: string;
  /** Provider-specific attestation blob (TEE signature, ZK proof, etc.). */
  attestation: unknown;
  /** Identifier the attestation can be verified against later. */
  attestationId: string | null;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Tool calls if the model decided to invoke tools. */
  toolCalls?: ReadonlyArray<{ name: string; arguments: string }>;
}

export interface InferenceProvider {
  readonly name: string;
  /** Run an inference request and return an attested response. */
  infer(req: InferenceRequest): Promise<AttestedResponse>;
  /** Verify an attestation (replayable, off the hot path). */
  verifyAttestation(attestationId: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────
//  Storage
// ─────────────────────────────────────────────────────────────

export interface StorageRef {
  /** Provider-specific opaque id (0G Storage merkle root, IPFS CID, etc.). */
  id: string;
  /** Optional human-readable URI. */
  uri?: string;
  /** Size in bytes. */
  bytes?: number;
}

export interface StorageProvider {
  readonly name: string;
  /** Persist binary data; returns an immutable reference. */
  put(data: Uint8Array, opts?: { contentType?: string }): Promise<StorageRef>;
  /** Retrieve data by reference. */
  get(ref: StorageRef): Promise<Uint8Array>;
  /** JSON-typed convenience wrapper. */
  putJSON<T>(value: T): Promise<StorageRef>;
  getJSON<T>(ref: StorageRef): Promise<T>;
}

// ─────────────────────────────────────────────────────────────
//  Messaging (P2P bus)
// ─────────────────────────────────────────────────────────────

export type MessageHandler = (msg: SwarmMessage, sender: string) => Promise<void> | void;

export interface MessagingProvider {
  readonly name: string;
  /** Local peer identifier on the underlying mesh. */
  readonly peerId: string;

  /** Subscribe to inbound messages. Returns an unsubscribe fn. */
  subscribe(handler: MessageHandler): () => void;

  /** Broadcast to all peers. */
  broadcast(msg: SwarmMessage): Promise<void>;

  /** Direct message to one peer. */
  send(peerId: string, msg: SwarmMessage): Promise<void>;

  /** List currently known peers. */
  peers(): Promise<string[]>;
}

// ─────────────────────────────────────────────────────────────
//  Payment
// ─────────────────────────────────────────────────────────────

export interface PayoutSpec {
  recipient: string;
  amountUnits: string; // bigint as decimal
}

export interface PaymentProvider {
  readonly name: string;
  /** Trigger a multi-recipient payout. Implementation may use direct tx, KH, etc. */
  distribute(bountyKey: string, payouts: ReadonlyArray<PayoutSpec>): Promise<{ executionId: string }>;
  /** Poll status of a previous distribute call. */
  getStatus(executionId: string): Promise<"pending" | "running" | "completed" | "failed">;
}

// ─────────────────────────────────────────────────────────────
//  Retrieval (web search / external knowledge)
// ─────────────────────────────────────────────────────────────

export interface RetrievalResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

export interface RetrievalProvider {
  readonly name: string;
  search(query: string, opts?: { maxResults?: number }): Promise<RetrievalResult[]>;
  fetchUrl(url: string): Promise<{ status: number; content: string }>;
}

// ─────────────────────────────────────────────────────────────
//  Reputation (optional but recommended)
// ─────────────────────────────────────────────────────────────

export interface ReputationProvider {
  readonly name: string;
  /** Read aggregated reputation for an agent under a tag. */
  read(agentId: string, tag1: string, tag2?: string): Promise<{ count: number; avg: number }>;
  /** Submit feedback (typically called by Critic + user). */
  feedback(args: {
    agentId: string;
    value: number; // 0..100 scale by convention
    tag1: string;
    tag2: string;
    detailURI?: string;
    detailHash?: string;
  }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
//  Chain adapter (on-chain Bounty state-machine ops)
// ─────────────────────────────────────────────────────────────

export interface ChainTxResult {
  txHash: string;
}

export interface ChainPayoutPreview {
  recipients: string[];
  amounts: bigint[];
}

export interface ChainSubmitSynthesisResult extends ChainTxResult {
  /** LayerZero V2 message GUID emitted by the Bounty (when wired). */
  lzGuid: string | null;
  /** LayerZero nonce. */
  lzNonce: bigint | null;
  /** msg.value paid as native fee. */
  lzFeePaid: bigint;
  /** Payouts dispatched (parsed from PayoutDispatched event). */
  recipients: string[];
  amounts: bigint[];
}

/**
 * On-chain coordination layer. Each agent runtime owns one ChainAdapter
 * backed by its own operator wallet — so role.handle(...) can call
 * chain.placeBid(...) directly without orchestrator routing.
 */
export interface ChainAdapter {
  readonly name: string;

  /** Address of the wallet signing on behalf of this agent. */
  readonly signerAddress: string;

  /** Convenience: read the current Bounty status (0..7). */
  bountyStatus(bountyAddress: string): Promise<number>;

  /** Read final report root after Completed. */
  bountyFinalReportRoot(bountyAddress: string): Promise<string>;

  /** Read previewPayouts (recipients + amounts) before synthesis. */
  bountyPreviewPayouts(bountyAddress: string): Promise<ChainPayoutPreview>;

  /** Quote LZ V2 native fee for a synthesis dispatch. */
  quoteSynthesisLzFee(
    bountyAddress: string,
    bountyId: bigint,
    recipients: string[],
    amounts: bigint[],
  ): Promise<bigint>;

  // ----- State-machine transitions -----

  acceptPlanner(bountyAddress: string, plannerAgentId: bigint): Promise<ChainTxResult>;

  broadcastSubTasks(bountyAddress: string, descriptions: string[]): Promise<ChainTxResult>;

  placeBid(
    bountyAddress: string,
    subTaskIndex: number,
    agentId: bigint,
    price: bigint,
    reputationSnapshot: bigint,
  ): Promise<ChainTxResult>;

  awardBid(
    bountyAddress: string,
    subTaskIndex: number,
    agentId: bigint,
  ): Promise<ChainTxResult>;

  submitFindings(
    bountyAddress: string,
    subTaskIndex: number,
    agentId: bigint,
    findingsRoot: string,
  ): Promise<ChainTxResult>;

  reviewClaim(
    bountyAddress: string,
    subTaskIndex: number,
    criticAgentId: bigint,
    approved: boolean,
    reasonURI: string,
  ): Promise<ChainTxResult>;

  /**
   * Synthesizer's terminal call. The Bounty contract is `payable` at
   * `submitSynthesis`; if a messenger is wired, it atomically dispatches
   * `notifyCompletion` over LayerZero V2 in the same tx as the status flip
   * to Completed. `lzFeeWei` should equal `quoteSynthesisLzFee()` exactly
   * (OApp `_payNative` rejects buffers).
   */
  submitSynthesisAndFireLZ(
    bountyAddress: string,
    synthesizerAgentId: bigint,
    reportRoot: string,
    lzFeeWei: bigint,
  ): Promise<ChainSubmitSynthesisResult>;
}

// ─────────────────────────────────────────────────────────────
//  Composite — what an Agent runtime needs
// ─────────────────────────────────────────────────────────────

export interface AgentProviders {
  inference: InferenceProvider;
  storage: StorageProvider;
  messaging: MessagingProvider;
  payment?: PaymentProvider; // not every role calls payment
  retrieval?: RetrievalProvider; // researchers need this
  reputation?: ReputationProvider;
  chain?: ChainAdapter; // multi-process runtimes wire one per agent
}
