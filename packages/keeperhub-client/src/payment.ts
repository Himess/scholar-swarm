/**
 * KeeperHub → PaymentProvider adapter.
 *
 * Calls KH Direct Execution API to invoke `PaymentRouter.distribute()` on
 * Base Sepolia. KH provides retry, gas estimation, audit trail.
 * Endpoints (verified Day 3):
 *   POST /api/execute/contract-call  → returns { executionId, status }
 *   GET  /api/execute/{id}/status    → polls execution status
 */

import type { PaymentProvider, PayoutSpec } from "@scholar-swarm/sdk";

export interface KeeperHubConfig {
  /** Base URL — default https://app.keeperhub.com/api */
  endpoint?: string;
  /** kh_ prefixed API key (full account scope). */
  apiKey: string;
  /** Network identifier accepted by KH (e.g. "base-sepolia"). */
  network: string;
  /** PaymentRouter contract address on the chosen network. */
  paymentRouter: string;
  /** Optional gas limit multiplier passed through to KH. Default "1.2". */
  gasLimitMultiplier?: string;
}

const DISTRIBUTE_ABI = [
  {
    type: "function",
    name: "distribute",
    inputs: [
      { name: "bountyKey", type: "bytes32" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

export class KeeperHubPaymentProvider implements PaymentProvider {
  readonly name = "keeperhub";
  private endpoint: string;

  constructor(private readonly cfg: KeeperHubConfig) {
    this.endpoint = cfg.endpoint ?? "https://app.keeperhub.com/api";
  }

  async distribute(
    bountyKey: string,
    payouts: ReadonlyArray<PayoutSpec>,
  ): Promise<{ executionId: string }> {
    const recipients = payouts.map((p) => p.recipient);
    const amounts = payouts.map((p) => p.amountUnits);

    const body = {
      contractAddress: this.cfg.paymentRouter,
      network: this.cfg.network,
      functionName: "distribute",
      functionArgs: JSON.stringify([bountyKey, recipients, amounts]),
      abi: JSON.stringify(DISTRIBUTE_ABI),
      value: "0",
      gasLimitMultiplier: this.cfg.gasLimitMultiplier ?? "1.2",
    };

    const res = await fetch(`${this.endpoint}/execute/contract-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 202) {
      const text = await res.text();
      throw new Error(`KH execute ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = (await res.json()) as { executionId: string; status?: string };
    return { executionId: data.executionId };
  }

  async getStatus(executionId: string): Promise<"pending" | "running" | "completed" | "failed"> {
    const res = await fetch(`${this.endpoint}/execute/${executionId}/status`, {
      headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
    });
    if (!res.ok) throw new Error(`KH status ${res.status}`);
    const data = (await res.json()) as { status: string };
    const s = data.status as "pending" | "running" | "completed" | "failed";
    return s;
  }
}
