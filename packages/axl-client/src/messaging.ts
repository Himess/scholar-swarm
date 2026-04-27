/**
 * AXL → MessagingProvider adapter.
 *
 * AXL is a sidecar binary (gensyn-ai/axl, Go) running on localhost:9002. Endpoints:
 *   POST /send                       — send to peer
 *   GET  /recv                       — poll inbound queue
 *   GET  /topology                   — list known peers
 *   POST /mcp/{peerId}/{service}     — call remote MCP tool over AXL
 *
 * This adapter polls /recv (long-poll friendly) on a background loop and
 * dispatches each message to subscribed handlers.
 */

import type { MessageHandler, MessagingProvider } from "@scholar-swarm/sdk";
import type { SwarmMessage } from "@scholar-swarm/sdk";

export interface AXLConfig {
  /** AXL local HTTP API base URL. Default: http://localhost:9002 */
  endpoint?: string;
  /** Our peer id on the AXL mesh (ed25519 public key). Required. */
  peerId: string;
  /** Polling interval in ms for inbound messages. Default 500. */
  pollIntervalMs?: number;
}

interface AXLEnvelope {
  from: string;
  to: string | "broadcast";
  payload: string; // JSON
  ts: number;
}

export class AXLMessagingProvider implements MessagingProvider {
  readonly name = "axl";
  readonly peerId: string;

  private endpoint: string;
  private pollIntervalMs: number;
  private handlers = new Set<MessageHandler>();
  private polling = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(cfg: AXLConfig) {
    this.peerId = cfg.peerId;
    this.endpoint = cfg.endpoint ?? "http://localhost:9002";
    this.pollIntervalMs = cfg.pollIntervalMs ?? 500;
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    if (!this.polling) this.startPolling();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stopPolling();
    };
  }

  async broadcast(msg: SwarmMessage): Promise<void> {
    await this.postSend("broadcast", msg);
  }

  async send(peerId: string, msg: SwarmMessage): Promise<void> {
    await this.postSend(peerId, msg);
  }

  async peers(): Promise<string[]> {
    const res = await fetch(`${this.endpoint}/topology`);
    if (!res.ok) throw new Error(`AXL /topology ${res.status}`);
    const data = (await res.json()) as { peers?: string[] };
    return data.peers ?? [];
  }

  // ────────── internal ──────────

  private async postSend(to: string, msg: SwarmMessage): Promise<void> {
    const envelope: AXLEnvelope = {
      from: this.peerId,
      to,
      payload: JSON.stringify(msg),
      ts: Date.now(),
    };
    const res = await fetch(`${this.endpoint}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
    if (!res.ok) throw new Error(`AXL /send ${res.status}: ${await res.text()}`);
  }

  private startPolling(): void {
    this.polling = true;
    this.timer = setInterval(() => {
      this.poll().catch((err: Error) => console.error(`[axl] poll error: ${err.message}`));
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    this.polling = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    const res = await fetch(`${this.endpoint}/recv`);
    if (!res.ok) return;
    const envs = (await res.json()) as AXLEnvelope[];
    for (const env of envs) {
      let parsed: SwarmMessage;
      try {
        parsed = JSON.parse(env.payload) as SwarmMessage;
      } catch {
        continue;
      }
      for (const h of this.handlers) {
        await Promise.resolve(h(parsed, env.from));
      }
    }
  }
}
