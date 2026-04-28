/**
 * Researcher agent runtime entrypoint.
 *
 * Two instances run as separate operators (RESEARCHER_NUMBER=1 or 2).
 *
 *   RESEARCHER_NUMBER=1 pnpm --filter @scholar-swarm/agent-researcher start
 */

import { Agent } from "@scholar-swarm/sdk";
import type { AgentProviders, RetrievalProvider } from "@scholar-swarm/sdk";
import {
  EVMChainAdapter,
  OGComputeInferenceProvider,
  OGStorageProvider,
} from "@scholar-swarm/og-client";
import { AXLMessagingProvider } from "@scholar-swarm/axl-client";
import {
  SearxRetrievalProvider,
  TavilyRetrievalProvider,
} from "@scholar-swarm/mcp-tools";

import { ResearcherRole } from "./role.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pickRetrieval(): RetrievalProvider | undefined {
  const explicit = process.env["RETRIEVAL_PROVIDER"]?.toLowerCase();
  const searx = process.env["SEARXNG_ENDPOINT"];
  const tav = process.env["TAVILY_API_KEY"];
  if (explicit === "searxng" && searx) return new SearxRetrievalProvider({ endpoint: searx });
  if (explicit === "tavily" && tav)
    return new TavilyRetrievalProvider({ apiKey: tav, searchDepth: "basic" });
  if (searx) return new SearxRetrievalProvider({ endpoint: searx });
  if (tav) return new TavilyRetrievalProvider({ apiKey: tav, searchDepth: "basic" });
  return undefined;
}

async function main(): Promise<void> {
  const number = process.env["RESEARCHER_NUMBER"] ?? "1";
  const log = makeLogger(`researcher-${number}`);

  const keyEnv = `RESEARCHER_${number}_OPERATOR_KEY`;
  const agentIdEnv = `RESEARCHER_${number}_AGENT_ID`;
  const walletEnv = `RESEARCHER_${number}_OPERATOR_WALLET`;
  const peerIdEnv = `AXL_PEER_ID_RESEARCHER_${number}`;
  const apiPortEnv = `AXL_ENDPOINT_RESEARCHER_${number}`;

  const operatorKey = must(keyEnv);

  const inference = await OGComputeInferenceProvider.create({
    rpcUrl: process.env["OG_RPC_URL"],
    privateKey: operatorKey,
  });
  log("0G Compute ready (own ledger)");

  const storage = new OGStorageProvider({
    rpcUrl: process.env["OG_RPC_URL"],
    indexerRpc: process.env["OG_STORAGE_ENDPOINT"],
    privateKey: operatorKey,
  });
  log("0G Storage ready (own wallet)");

  const messaging = new AXLMessagingProvider({
    endpoint: process.env[apiPortEnv] ?? `http://127.0.0.1:910${number === "1" ? "2" : "3"}`,
    peerId: must(peerIdEnv),
    staticPeers: [
      process.env["AXL_PEER_ID_PLANNER"],
      process.env["AXL_PEER_ID_RESEARCHER_1"],
      process.env["AXL_PEER_ID_RESEARCHER_2"],
      process.env["AXL_PEER_ID_CRITIC"],
      process.env["AXL_PEER_ID_SYNTHESIZER"],
    ].filter((x): x is string => typeof x === "string" && x.length > 0),
    log,
  });
  log(`AXL messaging ready peer=${messaging.peerId.slice(0, 12)}…`);

  const chain = new EVMChainAdapter({
    rpcUrl: process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai",
    privateKey: operatorKey,
    messengerAddress: must("OG_BOUNTY_MESSENGER"),
  });
  log(`Chain adapter ready signer=${chain.signerAddress}`);

  const retrieval = pickRetrieval();
  log(`Retrieval: ${retrieval?.name ?? "(none, will use stub)"}`);

  const providers: AgentProviders = { inference, storage, messaging, chain };
  if (retrieval) providers.retrieval = retrieval;

  const agentId = process.env[agentIdEnv] ?? (number === "1" ? "2" : "3");

  const agent = new Agent({
    agentId,
    operatorWallet: must(walletEnv),
    providers,
    role: new ResearcherRole({
      basePriceUnits: process.env["RESEARCHER_BASE_PRICE"] ?? "200000000",
      reputationSnapshot: Number(process.env["RESEARCHER_REPUTATION"] ?? 0),
    }),
    log,
  });

  await agent.start();
  log(`researcher-${number} running`);

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
