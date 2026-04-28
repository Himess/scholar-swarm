/**
 * Planner agent runtime entrypoint.
 *
 * Reads env, wires providers + chain adapter, starts the agent loop.
 * One Planner per swarm.
 *
 *   pnpm --filter @scholar-swarm/agent-planner start
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders } from "@scholar-swarm/sdk";
import {
  EVMChainAdapter,
  OGComputeInferenceProvider,
} from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

import { PlannerRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const log = makeLogger("planner");

  const operatorKey = must("PLANNER_OPERATOR_KEY");

  const inference = await OGComputeInferenceProvider.create({
    rpcUrl: process.env["OG_RPC_URL"],
    privateKey: operatorKey,
  });
  log(`0G Compute ready (own ledger, funded by spike-18-bootstrap-inference)`);

  const messaging = new AXLMessagingProvider({
    endpoint: process.env["AXL_ENDPOINT"] ?? "http://127.0.0.1:9101",
    peerId: must("AXL_PEER_ID"),
    staticPeers: collectSwarmPeers(),
    log,
  });
  log(`AXL messaging ready peer=${messaging.peerId.slice(0, 12)}…`);

  const chain = new EVMChainAdapter({
    rpcUrl: process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai",
    privateKey: operatorKey,
    messengerAddress: must("OG_BOUNTY_MESSENGER"),
  });
  log(`Chain adapter ready signer=${chain.signerAddress}`);

  // Note: inference + storage + chain all use this agent's OWN operatorKey.
  // The 0G Compute sub-account for this wallet is bootstrapped separately
  // by `scripts/spike-18-bootstrap-inference.ts` (run once before spike-18).

  // Planner doesn't need storage. Stub to satisfy the contract.
  const storage = makeStubStorage();

  const providers: AgentProviders = { inference, storage, messaging, chain };

  const agentId = process.env["PLANNER_AGENT_ID"] ?? "1";
  const operatorWallet = must("PLANNER_OPERATOR_WALLET");

  const agent = new Agent({
    agentId,
    operatorWallet,
    providers,
    role: new PlannerRole({ bidWindowMs: Number(process.env["BID_WINDOW_MS"] ?? 8_000) }),
    log,
  });

  await agent.start();
  log("planner running — waiting for bounty.broadcast over AXL");

  const shutdown = async (): Promise<void> => {
    log("shutdown signal received");
    await agent.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

function makeLogger(role: string) {
  return (msg: string, extra?: Record<string, unknown>): void => {
    const ts = new Date().toISOString();
    const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
    console.log(`${ts} [${role}] ${msg}${tail}`);
  };
}

/**
 * Static swarm-wide peer ID list — every agent's runtime reads the same env
 * vars and produces the same list, so broadcast() reaches the entire swarm
 * without depending on Yggdrasil's tree-update propagation. Self gets filtered
 * by the AXLMessagingProvider constructor.
 */
function collectSwarmPeers(): string[] {
  const ids = [
    process.env["AXL_PEER_ID_PLANNER"],
    process.env["AXL_PEER_ID_RESEARCHER_1"],
    process.env["AXL_PEER_ID_RESEARCHER_2"],
    process.env["AXL_PEER_ID_CRITIC"],
    process.env["AXL_PEER_ID_SYNTHESIZER"],
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  return ids;
}

function makeStubStorage(): AgentProviders["storage"] {
  return {
    name: "stub",
    put: async () => {
      throw new Error("storage not configured for planner");
    },
    get: async () => {
      throw new Error("storage not configured for planner");
    },
    putJSON: async () => {
      throw new Error("storage not configured for planner");
    },
    getJSON: async () => {
      throw new Error("storage not configured for planner");
    },
  };
}

main().catch((err: Error) => {
  console.error("planner crashed:", err);
  process.exit(1);
});
