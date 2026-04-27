/**
 * Planner agent runtime entrypoint.
 *
 * Reads env, wires providers, starts the agent loop. Designed to run as
 * its own process — one Planner per swarm.
 *
 *   pnpm --filter @scholar-swarm/agent-planner start
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders } from "@scholar-swarm/sdk";
import { OGComputeInferenceProvider } from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

import { PlannerRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const log = makeLogger("planner");

  const inference = await OGComputeInferenceProvider.create({
    rpcUrl: process.env["OG_RPC_URL"],
    privateKey: must("DEMO_PLANNER_KEY"),
  });
  log("0G Compute inference ready");

  const messaging = new AXLMessagingProvider({
    endpoint: process.env["AXL_ENDPOINT"],
    peerId: must("AXL_PEER_ID"),
  });
  log(`AXL messaging ready peer=${messaging.peerId}`);

  // Planner doesn't need storage. Provide a stub so the AgentProviders contract holds.
  const storage = makeStubStorage();

  const providers: AgentProviders = { inference, storage, messaging };

  const agentId = must("PLANNER_AGENT_ID");
  const operatorWallet = must("PLANNER_OPERATOR_WALLET");

  const agent = new Agent({
    agentId,
    operatorWallet,
    providers,
    role: new PlannerRole({ bidWindowMs: Number(process.env["BID_WINDOW_MS"] ?? 30_000) }),
    log,
  });

  await agent.start();
  log("planner running");

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
