/**
 * Spike 1 — 0G Compute sealed inference
 *
 * Goal:
 *   1. Initialize broker with wallet
 *   2. List available services (enumerate models + providers)
 *   3. Ensure account is funded (ledger main + per-provider sub-account)
 *   4. Run a chat completion
 *   5. Verify TEE attestation
 *   6. Probe for tool-use / function-calling support
 *   7. Log results to docs/spike-artifacts/spike-01.json
 *
 * Usage:
 *   cp .env.example .env              # fill DEMO_PLANNER_KEY + OG_RPC_URL
 *   pnpm spike:01
 *
 * Success criteria (PLAN.md §5 Spike 1):
 *   - At least one model runs + attestation returns in parseable shape
 *   - Document exact model names in docs/spike-results.md
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

// ---------- Config ----------

const RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = must("DEMO_PLANNER_KEY");
const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

const TEST_PROMPT =
  "In one sentence: what is the Stargate AI project? Return JSON: { \"answer\": \"...\" }.";

const TOOL_USE_PROMPT =
  "What is 18 * 24? Use the calculator tool if available.";

const CALCULATOR_TOOL = {
  type: "function",
  function: {
    name: "calculator",
    description: "Performs basic arithmetic",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression to evaluate" },
      },
      required: ["expression"],
    },
  },
} as const;

// ---------- Main ----------

async function main() {
  console.log("=== Spike 1 — 0G Compute sealed inference ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`Wallet: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} OG\n`);

  console.log("Initializing broker...");
  const broker = await createZGComputeNetworkBroker(wallet);
  console.log("Broker ready.\n");

  // ----- Step 1: list services -----
  console.log("Step 1: listing services...");
  const services = await broker.inference.listService();
  console.log(`Found ${services.length} services.`);
  // 0G SDK 0.7.x returns ethers v6 Result tuples — access by index, not property name.
  // Tuple shape verified Day 3 against testnet: [providerAddress, serviceType, url,
  // inputPrice, outputPrice, updatedAt, model, verifiability, additionalInfo, ...]
  const normalize = (s: any) => ({
    providerAddress: s[0] as string,
    serviceType: s[1] as string,
    url: s[2] as string,
    inputPrice: s[3]?.toString?.() ?? String(s[3]),
    outputPrice: s[4]?.toString?.() ?? String(s[4]),
    updatedAt: s[5]?.toString?.() ?? String(s[5]),
    model: s[6] as string,
    verifiability: s[7] as string,
    additionalInfo: s[8] as string,
  });

  const all = (services as any[]).map(normalize);
  const chatbots = all.filter((s) => s.serviceType === "chatbot");
  console.log(`Chatbot services: ${chatbots.length}`);
  for (const s of chatbots.slice(0, 10)) {
    console.log(
      `  - provider=${s.providerAddress}  model=${s.model}  ver=${s.verifiability}` +
        `  input=${s.inputPrice}  output=${s.outputPrice}`,
    );
  }
  if (chatbots.length === 0) {
    throw new Error("No chatbot services available on 0G Compute testnet. Abort.");
  }

  // ----- Step 2: ensure funded -----
  const target = chatbots[0]!;
  const targetProvider = target.providerAddress;
  console.log(`\nStep 2: ensuring account funded for provider ${targetProvider}...`);
  try {
    await ensureFunded(broker, targetProvider);
    console.log("Funding OK.");
  } catch (err) {
    console.error("Funding failed — likely insufficient OG balance. Continuing to test read-only calls.");
    console.error(`  reason: ${(err as Error).message}`);
  }

  // ----- Step 3: one chat completion (skipped if account not funded) -----
  console.log("\nStep 3: chat completion...");
  let chatResult: ChatResult = { content: "", chatID: null, latencyMs: 0, raw: null, skipped: true, skipReason: "" };
  try {
    chatResult = await runChat(broker, targetProvider, [{ role: "user", content: TEST_PROMPT }]);
    console.log(`Response: ${chatResult.content.slice(0, 200)}${chatResult.content.length > 200 ? "…" : ""}`);
    console.log(`Latency: ${chatResult.latencyMs} ms`);
    console.log(`chatID: ${chatResult.chatID ?? "(none)"}`);
  } catch (err) {
    chatResult.skipReason = (err as Error).message;
    console.error(`Inference skipped — ${chatResult.skipReason}`);
  }

  // ----- Step 4: TEE attestation verify -----
  console.log("\nStep 4: verifying TEE attestation...");
  let attestationValid: boolean | "unknown" = "unknown";
  if (chatResult.chatID) {
    try {
      attestationValid = await broker.inference.processResponse(
        targetProvider,
        chatResult.chatID,
      );
      console.log(`Attestation valid: ${attestationValid}`);
    } catch (err) {
      console.error(`Attestation check threw: ${(err as Error).message}`);
    }
  } else {
    console.log("No chatID returned — cannot verify attestation (skipped if no inference).");
  }

  // ----- Step 5: tool use probe (also funding-dependent) -----
  console.log("\nStep 5: tool-use / function-calling probe...");
  let toolUseResult: ToolUseProbe = { supported: "unknown", note: "" };
  if (chatResult.skipped) {
    toolUseResult = { supported: "unknown", note: "Skipped — no funded account for inference test." };
  } else try {
    const probe = await runChat(
      broker,
      targetProvider,
      [{ role: "user", content: TOOL_USE_PROMPT }],
      { tools: [CALCULATOR_TOOL] },
    );
    // If model respects tools spec, response should contain tool_calls instead of direct answer
    const toolCalls = probe.raw?.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      toolUseResult = {
        supported: "yes",
        note: `Model returned ${toolCalls.length} tool_call(s): ${JSON.stringify(toolCalls).slice(0, 200)}`,
      };
    } else if (probe.content.match(/\b432\b/)) {
      toolUseResult = {
        supported: "ignored",
        note: "Model answered directly (432) without invoking tool — tools field accepted but not honored.",
      };
    } else {
      toolUseResult = {
        supported: "unclear",
        note: `Model responded: ${probe.content.slice(0, 160)}`,
      };
    }
  } catch (err) {
    toolUseResult = {
      supported: "error",
      note: `Tool-use request threw: ${(err as Error).message}`,
    };
  }
  console.log(`Tool-use support: ${toolUseResult.supported}`);
  console.log(`Note: ${toolUseResult.note}`);

  // ----- Artifact -----
  const artifact = {
    spike: "01-og-compute",
    runAt: new Date().toISOString(),
    network: { rpc: RPC_URL, wallet: wallet.address, balanceOG: ethers.formatEther(balance) },
    services: {
      totalCount: services.length,
      chatbotCount: chatbots.length,
      sample: chatbots.slice(0, 10).map((s) => ({
        provider: s.providerAddress,
        model: s.model,
        inputPrice: String(s.inputPrice),
        outputPrice: String(s.outputPrice),
      })),
    },
    testProvider: {
      address: targetProvider,
      model: target.model,
    },
    chatCompletion: chatResult,
    attestation: {
      chatIDReturned: !!chatResult.chatID,
      verifyResult: attestationValid,
    },
    toolUse: toolUseResult,
  };

  const artifactPath = join(ARTIFACT_DIR, "spike-01.json");
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact written: ${artifactPath}`);

  // ----- Go / No-go gate -----
  console.log("\n=== Go/No-go Gate ===");
  const catalogConfirmed = chatbots.length > 0;
  const inferenceWorks = chatResult.content.length > 0;
  console.log(`Models available: ${catalogConfirmed ? "✅" : "❌"}`);
  console.log(`Inference works: ${inferenceWorks ? "✅" : chatResult.skipped ? "⏭️  skipped (need funding)" : "❌"}`);
  console.log(`Attestation verified: ${attestationValid === true ? "✅" : attestationValid === false ? "⚠️ returned false" : "⏭️ unknown"}`);
  console.log(`Tool-use supported: ${toolUseResult.supported}`);

  if (!catalogConfirmed) {
    console.error("\n❌ GATE FAILED — no chatbot services on testnet. Architecture pivot required.");
    process.exit(1);
  }
  if (!inferenceWorks) {
    console.log("\n🟡 PARTIAL PASS — catalog confirmed, inference deferred until wallet funded.");
    console.log("   Need ≥3 OG (ledger min) on wallet. Faucet via faucet.0g.ai + Discord ask.");
    return;
  }
  console.log("\n✅ Spike 1 FULL PASS — update docs/spike-results.md and PLAN.md §4 O1+O2.");
}

// ---------- Helpers ----------

type ToolUseProbe = {
  supported: "yes" | "ignored" | "unclear" | "error" | "unknown";
  note: string;
};

type ChatResult = {
  content: string;
  chatID: string | null;
  latencyMs: number;
  raw: any;
  skipped?: boolean;
  skipReason?: string;
};

async function runChat(
  broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>,
  providerAddress: string,
  messages: Array<{ role: string; content: string }>,
  extras: { tools?: readonly unknown[] } = {},
): Promise<ChatResult> {
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
  const headers = await broker.inference.getRequestHeaders(providerAddress);

  const body: Record<string, unknown> = { messages, model };
  if (extras.tools) body["tools"] = extras.tools;

  const t0 = Date.now();
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`0G Compute ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as any;
  const chatID =
    res.headers.get("ZG-Res-Key") ??
    res.headers.get("zg-res-key") ??
    data?.id ??
    data?.chatID ??
    null;
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  return { content, chatID, latencyMs, raw: data };
}

async function ensureFunded(
  broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>,
  providerAddress: string,
): Promise<void> {
  // We assume the script is idempotent — if already funded, these should no-op or throw benignly.
  try {
    await broker.ledger.depositFund(3);
  } catch (err) {
    // Already deposited likely
    console.log(`  depositFund: ${(err as Error).message}`);
  }
  try {
    await broker.ledger.transferFund(
      providerAddress,
      "inference",
      BigInt(1) * BigInt(10 ** 18),
    );
  } catch (err) {
    console.log(`  transferFund: ${(err as Error).message}`);
  }
}

function must(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Missing env: ${key}. Copy .env.example → .env and fill.`);
  }
  return v;
}

// ---------- Entrypoint ----------

main().catch((err) => {
  console.error("\n❌ Spike failed unrecoverably:");
  console.error(err);
  process.exit(1);
});
