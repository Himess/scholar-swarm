/**
 * Critic agent runtime entrypoint.
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders } from "@scholar-swarm/sdk";
import {
  EVMChainAdapter,
  OGComputeInferenceProvider,
  OGStorageProvider,
} from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

import { CriticRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const log = makeLogger("critic");
  const privateKey = must("CRITIC_OPERATOR_KEY");

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
    endpoint: process.env["AXL_ENDPOINT"] ?? "http://127.0.0.1:9104",
    peerId: must("AXL_PEER_ID_CRITIC"),
    staticPeers: [
      process.env["AXL_PEER_ID_PLANNER"],
      process.env["AXL_PEER_ID_RESEARCHER_1"],
      process.env["AXL_PEER_ID_RESEARCHER_2"],
      process.env["AXL_PEER_ID_CRITIC"],
      process.env["AXL_PEER_ID_SYNTHESIZER"],
    ].filter((x): x is string => typeof x === "string" && x.length > 0),
    log,
  });
  log(`AXL ready peer=${messaging.peerId.slice(0, 12)}…`);

  const chain = new EVMChainAdapter({
    rpcUrl: process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai",
    privateKey,
    messengerAddress: must("OG_BOUNTY_MESSENGER"),
  });
  log(`Chain adapter ready signer=${chain.signerAddress}`);

  const providers: AgentProviders = { inference, storage, messaging, chain };

  const agent = new Agent({
    agentId: process.env["CRITIC_AGENT_ID"] ?? "4",
    operatorWallet: must("CRITIC_OPERATOR_WALLET"),
    providers,
    role: new CriticRole({
      approvalThreshold: Number(process.env["CRITIC_APPROVAL_THRESHOLD"] ?? 0.66),
    }),
    log,
  });

  await agent.start();
  log("critic running");

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
  console.error("critic crashed:", err);
  process.exit(1);
});
