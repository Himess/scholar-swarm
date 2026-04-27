/**
 * 0G Compute → InferenceProvider adapter.
 *
 * Wraps `@0glabs/0g-serving-broker` to satisfy `InferenceProvider`.
 * Service tuple shape verified Day 3 (see docs/sponsor-reference.md):
 *   [providerAddress, serviceType, url, inputPrice, outputPrice, updatedAt,
 *    model, verifiability, additionalInfo, delivererAddress, enabled]
 */

import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import type {
  AttestedResponse,
  InferenceProvider,
  InferenceRequest,
} from "@scholar-swarm/sdk";

export interface OGComputeConfig {
  /** EVM RPC for 0G — testnet default if unset. */
  rpcUrl?: string;
  /** Hex private key (0x-prefixed). */
  privateKey: string;
  /** Optional: pin to a specific provider address. If unset, picks first chatbot. */
  preferredProvider?: string;
  /** Optional: pin to a specific model identifier. Filtered against listService. */
  preferredModel?: string;
}

interface ServiceTuple {
  providerAddress: string;
  serviceType: string;
  url: string;
  model: string;
  verifiability: string;
}

function normalizeService(s: any): ServiceTuple {
  return {
    providerAddress: s[0],
    serviceType: s[1],
    url: s[2],
    model: s[6],
    verifiability: s[7],
  };
}

export class OGComputeInferenceProvider implements InferenceProvider {
  readonly name = "0g-compute";
  private broker: any;
  private targetProvider: string | null = null;
  private targetModel: string | null = null;

  private constructor(
    private readonly cfg: OGComputeConfig,
    broker: any,
  ) {
    this.broker = broker;
  }

  static async create(cfg: OGComputeConfig): Promise<OGComputeInferenceProvider> {
    const rpc = cfg.rpcUrl ?? "https://evmrpc-testnet.0g.ai";
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(cfg.privateKey, provider);
    // ESM/CJS dual-build ethers types resolve to distinct TS instances even at the
    // same version — the runtime is identical, the types disagree. Cast at boundary.
    const broker = await createZGComputeNetworkBroker(wallet as any);
    const out = new OGComputeInferenceProvider(cfg, broker);
    await out.selectProvider();
    return out;
  }

  private async selectProvider(): Promise<void> {
    const services = ((await this.broker.inference.listService()) as any[]).map(normalizeService);
    const chatbots = services.filter((s) => s.serviceType === "chatbot");
    if (chatbots.length === 0) throw new Error("No chatbot services on 0G Compute");

    let chosen = chatbots[0];
    if (this.cfg.preferredProvider) {
      const match = chatbots.find(
        (s) => s.providerAddress.toLowerCase() === this.cfg.preferredProvider!.toLowerCase(),
      );
      if (match) chosen = match;
    } else if (this.cfg.preferredModel) {
      const match = chatbots.find((s) => s.model === this.cfg.preferredModel);
      if (match) chosen = match;
    }
    this.targetProvider = chosen!.providerAddress;
    this.targetModel = chosen!.model;
  }

  async infer(req: InferenceRequest): Promise<AttestedResponse> {
    if (!this.targetProvider || !this.targetModel) throw new Error("Provider not selected");

    const { endpoint } = await this.broker.inference.getServiceMetadata(this.targetProvider);
    const headers = await this.broker.inference.getRequestHeaders(this.targetProvider);

    const body: Record<string, unknown> = {
      messages: req.messages,
      model: req.model ?? this.targetModel,
    };
    if (req.tools) body["tools"] = req.tools;
    if (req.temperature !== undefined) body["temperature"] = req.temperature;
    if (req.maxTokens !== undefined) body["max_tokens"] = req.maxTokens;

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
    const data: any = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const chatID =
      res.headers.get("ZG-Res-Key") ?? res.headers.get("zg-res-key") ?? data?.id ?? null;

    const toolCallsRaw = data?.choices?.[0]?.message?.tool_calls as
      | Array<{ function: { name: string; arguments: string } }>
      | undefined;
    const toolCalls = toolCallsRaw?.map((tc) => ({
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    const result: AttestedResponse = {
      content,
      attestation: { provider: this.targetProvider, model: this.targetModel, chatID, raw: data },
      attestationId: chatID,
      latencyMs,
    };
    if (toolCalls && toolCalls.length > 0) {
      result.toolCalls = toolCalls;
    }
    return result;
  }

  async verifyAttestation(attestationId: string): Promise<boolean> {
    if (!this.targetProvider) return false;
    return await this.broker.inference.processResponse(this.targetProvider, attestationId);
  }
}
