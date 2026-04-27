/**
 * KeeperHub hosted MCP client.
 *
 * KH exposes a hosted MCP server at `https://app.keeperhub.com/mcp`
 * (Streamable HTTP transport, OAuth or `kh_`-prefixed API key bearer auth).
 * This wrapper connects, discovers tools, and exposes typed convenience
 * calls for the ones Scholar Swarm uses: `list_workflows`,
 * `execute_workflow`, `get_execution_status`, `list_action_schemas`,
 * `ai_generate_workflow`.
 *
 * Why MCP over REST? The KH prize criteria list "MCP server or CLI" as
 * the canonical integration surface. Using KH's own MCP transport means
 * tool discovery, schemas, and routing all flow through the protocol KH
 * publishes — deeper integration than calling REST endpoints directly.
 *
 * The REST `KeeperHubPaymentProvider` (./payment.ts) and this MCP client
 * coexist; PaymentProvider remains the production hot-path because it's
 * fewer hops, but the MCP client is what we drive workflows + audit
 * from agent code.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface KeeperHubMCPConfig {
  /** Hosted MCP endpoint. Default: https://app.keeperhub.com/mcp */
  endpoint?: string;
  /** kh_-prefixed API key (full account scope). */
  apiKey: string;
  /** Logical client name reported in MCP handshake. */
  clientName?: string;
  /** SemVer of OUR client (informational). */
  clientVersion?: string;
}

export interface CallToolResult {
  ok: boolean;
  content: unknown;
  isError: boolean;
}

export class KeeperHubMCPClient {
  private cfg: Required<KeeperHubMCPConfig>;
  private client: Client | null = null;

  constructor(cfg: KeeperHubMCPConfig) {
    this.cfg = {
      endpoint: cfg.endpoint ?? "https://app.keeperhub.com/mcp",
      apiKey: cfg.apiKey,
      clientName: cfg.clientName ?? "scholar-swarm",
      clientVersion: cfg.clientVersion ?? "0.0.1",
    };
  }

  /** Connect + handshake. Idempotent. */
  async connect(): Promise<void> {
    if (this.client) return;
    const transport = new StreamableHTTPClientTransport(new URL(this.cfg.endpoint), {
      requestInit: {
        headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
      },
    });
    const client = new Client({
      name: this.cfg.clientName,
      version: this.cfg.clientVersion,
    });
    await client.connect(transport);
    this.client = client;
  }

  /** List all tools the KH MCP server exposes. */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    await this.connect();
    const result = await this.client!.listTools();
    return result.tools.map((t) => {
      const out: { name: string; description?: string } = { name: t.name };
      if (typeof t.description === "string") out.description = t.description;
      return out;
    });
  }

  /** Generic tool invocation. Specific tool wrappers below for ergonomics. */
  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    await this.connect();
    const r = await this.client!.callTool({ name, arguments: args });
    return {
      ok: !r.isError,
      content: r.content,
      isError: !!r.isError,
    };
  }

  // ────────── Convenience wrappers (canonical KH tools) ──────────

  /** List workflows accessible to this org. */
  async listWorkflows(opts: { limit?: number; offset?: number } = {}): Promise<CallToolResult> {
    return this.callTool("list_workflows", opts as Record<string, unknown>);
  }

  /** Get a workflow definition by id. */
  async getWorkflow(id: string): Promise<CallToolResult> {
    return this.callTool("get_workflow", { id });
  }

  /** Execute a workflow by id. Returns an execution handle. */
  async executeWorkflow(id: string, input?: Record<string, unknown>): Promise<CallToolResult> {
    return this.callTool("execute_workflow", { id, ...(input ? { input } : {}) });
  }

  /** Poll execution status. */
  async getExecutionStatus(executionId: string): Promise<CallToolResult> {
    return this.callTool("get_execution_status", { executionId });
  }

  /** Read full execution logs (steps, errors, tx hashes). */
  async getExecutionLogs(executionId: string): Promise<CallToolResult> {
    return this.callTool("get_execution_logs", { executionId });
  }

  /** Discover available action schemas (web3, discord, sendgrid, …). */
  async listActionSchemas(actionType?: string): Promise<CallToolResult> {
    return this.callTool("list_action_schemas", actionType ? { actionType } : {});
  }

  /** Ask KH to AI-generate a workflow from a natural-language prompt. */
  async aiGenerateWorkflow(prompt: string): Promise<CallToolResult> {
    return this.callTool("ai_generate_workflow", { prompt });
  }

  /** Inspect this org's wallet integration (Para wallet on KH). */
  async getWalletIntegration(): Promise<CallToolResult> {
    return this.callTool("get_wallet_integration", {});
  }

  /** Cleanup (close transport). */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
