/**
 * Researcher agent runtime entrypoint.
 *
 * Multiple instances of this binary run as separate operators. Each reads
 * RESEARCHER_NUMBER (1 or 2) from env to pick its agent id + wallet.
 *
 *   RESEARCHER_NUMBER=1 pnpm --filter @scholar-swarm/agent-researcher start
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders } from "@scholar-swarm/sdk";
import { OGComputeInferenceProvider, OGStorageProvider } from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

import { ResearcherRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const number = process.env["RESEARCHER_NUMBER"] ?? "1";
  const log = makeLogger(`researcher-${number}`);

  const keyEnv = `DEMO_RESEARCHER_${number}_KEY`;
  const agentIdEnv = `RESEARCHER_${number}_AGENT_ID`;
  const walletEnv = `RESEARCHER_${number}_OPERATOR_WALLET`;
  const peerIdEnv = `AXL_PEER_ID_RESEARCHER_${number}`;

  const privateKey = must(keyEnv);

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
    peerId: must(peerIdEnv),
  });
  log(`AXL ready peer=${messaging.peerId}`);

  const providers: AgentProviders = { inference, storage, messaging };

  const agent = new Agent({
    agentId: must(agentIdEnv),
    operatorWallet: must(walletEnv),
    providers,
    role: new ResearcherRole({
      basePriceUnits: process.env["RESEARCHER_BASE_PRICE"] ?? "200000000",
      reputationSnapshot: Number(process.env["RESEARCHER_REPUTATION"] ?? 0),
    }),
    log,
  });

  await agent.start();
  log("researcher running");

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
  console.error("researcher crashed:", err);
  process.exit(1);
});
