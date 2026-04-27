/**
 * Synthesizer agent runtime entrypoint.
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders } from "@scholar-swarm/sdk";
import { OGComputeInferenceProvider, OGStorageProvider } from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

import { SynthesizerRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const log = makeLogger("synthesizer");
  const privateKey = must("DEMO_SYNTHESIZER_KEY");

  const inference = await OGComputeInferenceProvider.create({
    rpcUrl: process.env["OG_RPC_URL"],
    privateKey,
  });
  log("0G Compute ready");

  const storage = new OGStorageProvider({
    rpcUrl: process.env["OG_RPC_URL"],
    indexerRpc: process.env["OG_STORAGE_ENDPOINT"],
    privateKey,
  });
  log("0G Storage ready");

  const messaging = new AXLMessagingProvider({
    endpoint: process.env["AXL_ENDPOINT"],
    peerId: must("AXL_PEER_ID_SYNTHESIZER"),
  });
  log(`AXL ready peer=${messaging.peerId}`);

  const providers: AgentProviders = { inference, storage, messaging };

  const agent = new Agent({
    agentId: must("SYNTHESIZER_AGENT_ID"),
    operatorWallet: must("SYNTHESIZER_OPERATOR_WALLET"),
    providers,
    role: new SynthesizerRole({
      expectedSubTasks: Number(process.env["EXPECTED_SUB_TASKS"] ?? 3),
    }),
    log,
  });

  await agent.start();
  log("synthesizer running");

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

main().catch((err: Error) => {
  console.error("synthesizer crashed:", err);
  process.exit(1);
});
