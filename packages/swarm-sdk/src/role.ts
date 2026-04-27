/**
 * Abstract Role base class.
 *
 * A Role encapsulates the *behavior* an agent performs (planning, researching,
 * critiquing, synthesizing). The Role does NOT know about transport or storage
 * directly — it composes the providers handed to it. This is what lets the
 * SAME Role implementation run in totally different environments.
 *
 * To define a new role, extend `Role` and implement `handle`. Register it with
 * an `Agent` to wire it into the messaging bus + provider stack.
 */

import type { AgentProviders } from "./providers.js";
import type { RoleId, SwarmMessage } from "./types.js";

export interface RoleContext {
  /** Stable agent identifier (e.g., on-chain agentId or wallet address). */
  agentId: string;
  /** Operator wallet address. */
  operatorWallet: string;
  /** Pluggable providers. */
  providers: AgentProviders;
  /** Optional structured logger. */
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export abstract class Role {
  abstract readonly id: RoleId;
  protected ctx!: RoleContext;

  bind(ctx: RoleContext): void {
    this.ctx = ctx;
  }

  /**
   * Inbound message handler. Each role decides which messages it cares about
   * by inspecting `msg.kind`.  Override to implement role behavior.
   */
  abstract handle(msg: SwarmMessage, sender: string): Promise<void>;

  /**
   * Optional periodic tick (e.g., poll for new bounties, retry failed tasks).
   * Default no-op.
   */
  async tick(): Promise<void> {}

  // ────────── Helpers commonly needed by role implementations ──────────

  protected async broadcast(msg: SwarmMessage): Promise<void> {
    return this.ctx.providers.messaging.broadcast(msg);
  }

  protected async sendTo(peerId: string, msg: SwarmMessage): Promise<void> {
    return this.ctx.providers.messaging.send(peerId, msg);
  }

  protected log(message: string, extra?: Record<string, unknown>): void {
    if (this.ctx.log) this.ctx.log(message, extra);
    else console.log(`[${this.id}] ${message}`, extra ?? "");
  }
}
