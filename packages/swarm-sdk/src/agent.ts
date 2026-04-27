/**
 * Agent runtime — composes providers + role + lifecycle.
 *
 * Usage:
 *
 *   const agent = new Agent({
 *     agentId,
 *     operatorWallet,
 *     providers: { inference, storage, messaging, ... },
 *     role: new MyResearcherRole(),
 *   });
 *   await agent.start();
 *
 * The agent subscribes to the messaging provider and dispatches inbound
 * messages to the bound role. Periodic ticks fire on the configured interval.
 */

import type { AgentProviders } from "./providers.js";
import type { Role, RoleContext } from "./role.js";
import type { SwarmMessage } from "./types.js";

export interface AgentConfig {
  agentId: string;
  operatorWallet: string;
  providers: AgentProviders;
  role: Role;
  tickIntervalMs?: number;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export class Agent {
  private cfg: AgentConfig;
  private unsubscribe: (() => void) | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: AgentConfig) {
    this.cfg = config;
    const ctx: RoleContext = {
      agentId: config.agentId,
      operatorWallet: config.operatorWallet,
      providers: config.providers,
      log: config.log,
    };
    config.role.bind(ctx);
  }

  get peerId(): string {
    return this.cfg.providers.messaging.peerId;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.log(`agent starting — role=${this.cfg.role.id} peer=${this.peerId}`);

    this.unsubscribe = this.cfg.providers.messaging.subscribe(async (msg, sender) => {
      try {
        await this.cfg.role.handle(msg, sender);
      } catch (err) {
        this.log(`role.handle threw on ${msg.kind}: ${(err as Error).message}`);
      }
    });

    if (this.cfg.tickIntervalMs && this.cfg.tickIntervalMs > 0) {
      this.tickTimer = setInterval(() => {
        this.cfg.role.tick().catch((err: Error) => this.log(`tick error: ${err.message}`));
      }, this.cfg.tickIntervalMs);
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.unsubscribe) this.unsubscribe();
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.log(`agent stopped — role=${this.cfg.role.id}`);
  }

  /** Convenience: broadcast a message regardless of role. */
  async broadcast(msg: SwarmMessage): Promise<void> {
    return this.cfg.providers.messaging.broadcast(msg);
  }

  private log(msg: string): void {
    if (this.cfg.log) this.cfg.log(msg);
    else console.log(`[agent ${this.cfg.role.id}] ${msg}`);
  }
}
