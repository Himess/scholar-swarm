/**
 * Synthesizer agent runtime entrypoint.
 *
 * Last in the choreography. When all 3 reviews come in approved, runs
 * synthesis (0G inference) + persists report on 0G Storage + fires the
 * cross-chain payout via Bounty.submitSynthesis (which atomically calls
 * BountyMessenger.notifyCompletion via LayerZero V2).
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders } from "@scholar-swarm/sdk";
import {
  EVMChainAdapter,
  OGComputeInferenceProvider,
  OGStorageProvider,
} from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";

import { SynthesizerRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const log = makeLogger("synthesizer");
  const privateKey = must("SYNTHESIZER_OPERATOR_KEY");

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
    endpoint: process.env["AXL_ENDPOINT"] ?? "http://127.0.0.1:9105",
    peerId: must("AXL_PEER_ID_SYNTHESIZER"),
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
    agentId: process.env["SYNTHESIZER_AGENT_ID"] ?? "5",
    operatorWallet: must("SYNTHESIZER_OPERATOR_WALLET"),
    providers,
    role: new SynthesizerRole({
      expectedSubTasks: Number(process.env["EXPECTED_SUB_TASKS"] ?? 3),
      synthFeeBaseUnits: BigInt(process.env["SYNTH_FEE_BASE_UNITS"] ?? "100000000"),
    }),
    log,
  });

  await agent.start();
  log("synthesizer running — listening for findings + reviews");

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
