/**
 * AXL → MessagingProvider adapter.
 *
 * AXL is a sidecar binary (gensyn-ai/axl, Go) that runs on each node and
 * exposes a local HTTP API. The real API contract (verified Day 8 against
 * a live two-node mesh):
 *
 *   POST /send          — body = SwarmMessage JSON
 *                         header X-Destination-Peer-Id = recipient public key
 *                         (32-byte ed25519 pubkey, hex without 0x prefix)
 *   POST /recv          — body = "{}", returns ONE message popped from the
 *                         inbound queue (or 200 with no body / null when empty).
 *                         POP semantics — only one consumer per AXL node.
 *   GET  /topology      — { our_ipv6, our_public_key, peers: [...], tree: [...] }
 *                         peers entries: { uri, up, public_key, port, coords }.
 *
 * Because /recv is POP-once (not pub/sub), each agent process needs its own
 * AXL node — sharing a single node between processes loses messages to whichever
 * agent's poll loop won the race. In Spike 18 we run five AXL nodes on the
 * laptop (one per agent) all peered into the same Yggdrasil overlay; cross-ISP
 * agents on the EU VPS connect outbound to the laptop's listener.
 *
 * `broadcast()` is a Yggdrasil convenience: AXL has no native group send, so
 * we list peers via /topology and post /send to each in parallel.
 */

import type { MessageHandler, MessagingProvider } from "@scholar-swarm/sdk";
import type { SwarmMessage } from "@scholar-swarm/sdk";

export interface AXLConfig {
  /** AXL local HTTP API base URL. Default: http://localhost:9002 */
  endpoint?: string;
  /** Our peer id on the AXL mesh (ed25519 public key, hex, no 0x). Required. */
  peerId: string;
  /** Polling interval in ms for inbound messages. Default 250. */
  pollIntervalMs?: number;
  /** Optional structured logger. */
  log?: (msg: string, extra?: Record<string, unknown>) => void;
  /**
   * Optional static peer list for broadcast targets. If set, broadcast()
   * iterates this list instead of querying /topology.
   *
   * Why: Yggdrasil's spanning-tree view from a leaf node only shows self +
   * direct peers + nearby siblings — not the full mesh. /topology returns
   * partial info, so /send to "all peers we know about" misses agents that
   * are reachable through the overlay but not in our tree view. A static
   * list of every agent's pubkey (read from env at process start) ensures
   * broadcasts reach the entire swarm regardless of tree convergence state.
   */
  staticPeers?: string[];
}

interface TopologyPeer {
  uri?: string;
  up?: boolean;
  inbound?: boolean;
  public_key: string;
  port?: number;
}

interface TopologyResponse {
  our_ipv6?: string;
  our_public_key?: string;
  peers?: TopologyPeer[] | null;
  tree?: Array<{ public_key: string; parent: string; sequence: number }>;
}

export class AXLMessagingProvider implements MessagingProvider {
  readonly name = "axl";
  readonly peerId: string;

  private endpoint: string;
  private pollIntervalMs: number;
  private handlers = new Set<MessageHandler>();
  private polling = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private log: AXLConfig["log"];
  private staticPeers: string[];

  constructor(cfg: AXLConfig) {
    this.peerId = cfg.peerId;
    this.endpoint = cfg.endpoint ?? "http://localhost:9002";
    this.pollIntervalMs = cfg.pollIntervalMs ?? 250;
    this.log = cfg.log;
    this.staticPeers = (cfg.staticPeers ?? []).filter((k) => !!k && k !== this.peerId);
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    if (!this.polling) this.startPolling();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stopPolling();
    };
  }

  /**
   * AXL has no native broadcast. We enumerate peers from /topology and
   * /send to each in parallel. Self-peer is filtered (we never have ourselves
   * in `peers`, only in `our_public_key`, but defense-in-depth).
   */
  async broadcast(msg: SwarmMessage): Promise<void> {
    let targets: string[];
    if (this.staticPeers.length > 0) {
      targets = this.staticPeers;
    } else {
      const topo = await this.topology();
      targets = (topo.peers ?? [])
        .map((p) => p.public_key)
        .filter((k) => !!k && k !== this.peerId);
      if (topo.tree) {
        for (const t of topo.tree) {
          if (t.public_key && t.public_key !== this.peerId && !targets.includes(t.public_key)) {
            targets.push(t.public_key);
          }
        }
      }
    }

    if (targets.length === 0) {
      this.logf(`broadcast: no peers known yet`);
      return;
    }

    await Promise.all(targets.map((peer) => this.sendRaw(peer, msg)));
  }

  async send(peerId: string, msg: SwarmMessage): Promise<void> {
    if (peerId === this.peerId) return; // never loop back to self
    return this.sendRaw(peerId, msg);
  }

  /** Returns peer public keys reachable in the overlay (tree-based). */
  async peers(): Promise<string[]> {
    const topo = await this.topology();
    const set = new Set<string>();
    for (const p of topo.peers ?? []) if (p.public_key) set.add(p.public_key);
    for (const t of topo.tree ?? []) if (t.public_key) set.add(t.public_key);
    set.delete(this.peerId);
    return Array.from(set);
  }

  // ────────── internal ──────────

  private async topology(): Promise<TopologyResponse> {
    const res = await fetch(`${this.endpoint}/topology`);
    if (!res.ok) throw new Error(`AXL /topology ${res.status}`);
    return (await res.json()) as TopologyResponse;
  }

  private async sendRaw(peerId: string, msg: SwarmMessage): Promise<void> {
    const res = await fetch(`${this.endpoint}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Destination-Peer-Id": peerId,
      },
      body: JSON.stringify(msg),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AXL /send ${res.status}: ${text.slice(0, 160)}`);
    }
  }

  private startPolling(): void {
    this.polling = true;
    const tick = (): void => {
      if (!this.polling) return;
      this.poll()
        .catch((err: Error) => this.logf(`poll error: ${err.message}`))
        .finally(() => {
          if (!this.polling) return;
          this.timer = setTimeout(tick, this.pollIntervalMs);
        });
    };
    this.timer = setTimeout(tick, this.pollIntervalMs);
  }

  private stopPolling(): void {
    this.polling = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    const res = await fetch(`${this.endpoint}/recv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return;

    // /recv returns either:
    //   - the popped message as a JSON object (when one was queued)
    //   - empty body / null (when queue empty)
    const text = await res.text();
    if (!text || text === "null" || text === "{}") return;

    let parsed: SwarmMessage;
    try {
      parsed = JSON.parse(text) as SwarmMessage;
    } catch {
      this.logf(`drop unparseable inbound: ${text.slice(0, 80)}`);
      return;
    }

    // AXL doesn't expose the sender's pubkey through /recv. We pass an empty
    // string for `sender` — Roles use it only for logging. If we need it for
    // routing, a future protocol layer can include `from` inside the SwarmMessage.
    for (const h of this.handlers) {
      try {
        await Promise.resolve(h(parsed, ""));
      } catch (err) {
        this.logf(`handler threw on ${parsed.kind}: ${(err as Error).message}`);
      }
    }
  }

  private logf(msg: string): void {
    if (this.log) this.log(`[axl] ${msg}`);
  }
}
