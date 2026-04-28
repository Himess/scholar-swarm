/**
 * EVMChainAdapter — ChainAdapter impl backed by ethers v6 Wallet + Contract.
 *
 * One adapter per agent runtime, signing with that agent's operator wallet.
 * Reads/writes the V2 Bounty + BountyFactory + BountyMessenger contracts
 * deployed on 0G Galileo (chainId 16602). The same adapter would work on
 * any EVM L1 — the addresses are passed via constructor.
 *
 * This is the on-chain side of multi-process choreography: each Role calls
 * `ctx.providers.chain.<op>` directly instead of going through an orchestrator.
 */

import { ethers } from "ethers";

import type {
  ChainAdapter,
  ChainPayoutPreview,
  ChainSubmitSynthesisResult,
  ChainTxResult,
} from "@scholar-swarm/sdk";

const BOUNTY_ABI = [
  "function status() view returns (uint8)",
  "function finalReportRoot() view returns (bytes32)",
  "function previewPayouts() view returns (address[],uint256[])",
  "function bountyId() view returns (uint256)",
  "function bountyMessenger() view returns (address)",
  "function acceptPlanner(uint256 plannerAgentId)",
  "function broadcastSubTasks(string[] descriptions)",
  "function placeBid(uint8 subTaskIndex,uint256 agentId,uint256 price,uint64 reputationSnapshot)",
  "function awardBid(uint8 subTaskIndex,uint256 agentId)",
  "function submitFindings(uint8 subTaskIndex,uint256 agentId,bytes32 findingsRoot)",
  "function reviewClaim(uint8 subTaskIndex,uint256 criticAgentId,bool approved,string reasonURI)",
  "function submitSynthesis(uint256 synthesizerAgentId,bytes32 reportRoot) payable",
  "event PayoutDispatched(bytes32 indexed lzGuid,uint64 nonce,uint256 lzFeePaid,address[] recipients,uint256[] amounts)",
];

const MESSENGER_ABI = [
  "function quote(uint32 dstEid,uint256 bountyId,address[] recipients,uint256[] amounts,bytes extraOptions) view returns (tuple(uint256 nativeFee,uint256 lzTokenFee))",
];

export interface EVMChainConfig {
  /** EVM RPC URL (e.g. https://evmrpc-testnet.0g.ai for 0G Galileo). */
  rpcUrl: string;
  /** Hex private key (0x-prefixed) for the operator wallet. */
  privateKey: string;
  /** Address of the BountyMessenger contract for LZ fee quoting. */
  messengerAddress: string;
  /** Default gas limit for state-machine tx. Defaults to 1_500_000. */
  gasLimit?: bigint;
  /** Heavier gas limit for the synthesis tx (LZ V2 send is ~2.5M). Defaults to 3_500_000. */
  synthesisGasLimit?: bigint;
  /** Gas price (legacy mode) — 0G Galileo requires ≥ 2 gwei. Defaults to 4 gwei. */
  gasPriceGwei?: number;
}

export class EVMChainAdapter implements ChainAdapter {
  readonly name = "evm";
  readonly signerAddress: string;

  private readonly wallet: ethers.Wallet;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly messengerAddress: string;
  private readonly gasOpts: { gasLimit: bigint; gasPrice: bigint };
  private readonly synthGasOpts: { gasLimit: bigint; gasPrice: bigint };

  constructor(cfg: EVMChainConfig) {
    this.provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    this.wallet = new ethers.Wallet(cfg.privateKey, this.provider);
    this.signerAddress = this.wallet.address;
    this.messengerAddress = cfg.messengerAddress;
    const gp = ethers.parseUnits(String(cfg.gasPriceGwei ?? 4), "gwei");
    this.gasOpts = {
      gasLimit: cfg.gasLimit ?? 1_500_000n,
      gasPrice: gp,
    };
    this.synthGasOpts = {
      gasLimit: cfg.synthesisGasLimit ?? 3_500_000n,
      gasPrice: gp,
    };
  }

  // ----- views -----

  async bountyStatus(bountyAddress: string): Promise<number> {
    const c = this.bountyRO(bountyAddress);
    const s: bigint = await c.status();
    return Number(s);
  }

  async bountyFinalReportRoot(bountyAddress: string): Promise<string> {
    const c = this.bountyRO(bountyAddress);
    return (await c.finalReportRoot()) as string;
  }

  async bountyPreviewPayouts(bountyAddress: string): Promise<ChainPayoutPreview> {
    const c = this.bountyRO(bountyAddress);
    const raw = await c.previewPayouts();
    const recipients: string[] = Array.from(raw[0] ?? raw.recipients);
    const amountsRaw: unknown[] = Array.from(raw[1] ?? raw.amounts);
    const amounts: bigint[] = amountsRaw.map((x) => BigInt(x as bigint));
    return { recipients, amounts };
  }

  async quoteSynthesisLzFee(
    _bountyAddress: string,
    bountyId: bigint,
    recipients: string[],
    amounts: bigint[],
  ): Promise<bigint> {
    const m = new ethers.Contract(this.messengerAddress, MESSENGER_ABI, this.provider);
    const fee = await (m as any).quote(0, bountyId, recipients, amounts, "0x");
    return BigInt(fee.nativeFee);
  }

  // ----- writes -----

  async acceptPlanner(bountyAddress: string, plannerAgentId: bigint): Promise<ChainTxResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.acceptPlanner(plannerAgentId, this.gasOpts);
    await tx.wait();
    return { txHash: tx.hash };
  }

  async broadcastSubTasks(bountyAddress: string, descriptions: string[]): Promise<ChainTxResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.broadcastSubTasks(descriptions, this.gasOpts);
    await tx.wait();
    return { txHash: tx.hash };
  }

  async placeBid(
    bountyAddress: string,
    subTaskIndex: number,
    agentId: bigint,
    price: bigint,
    reputationSnapshot: bigint,
  ): Promise<ChainTxResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.placeBid(subTaskIndex, agentId, price, reputationSnapshot, this.gasOpts);
    await tx.wait();
    return { txHash: tx.hash };
  }

  async awardBid(
    bountyAddress: string,
    subTaskIndex: number,
    agentId: bigint,
  ): Promise<ChainTxResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.awardBid(subTaskIndex, agentId, this.gasOpts);
    await tx.wait();
    return { txHash: tx.hash };
  }

  async submitFindings(
    bountyAddress: string,
    subTaskIndex: number,
    agentId: bigint,
    findingsRoot: string,
  ): Promise<ChainTxResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.submitFindings(subTaskIndex, agentId, findingsRoot, this.gasOpts);
    await tx.wait();
    return { txHash: tx.hash };
  }

  async reviewClaim(
    bountyAddress: string,
    subTaskIndex: number,
    criticAgentId: bigint,
    approved: boolean,
    reasonURI: string,
  ): Promise<ChainTxResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.reviewClaim(subTaskIndex, criticAgentId, approved, reasonURI, this.gasOpts);
    await tx.wait();
    return { txHash: tx.hash };
  }

  async submitSynthesisAndFireLZ(
    bountyAddress: string,
    synthesizerAgentId: bigint,
    reportRoot: string,
    lzFeeWei: bigint,
  ): Promise<ChainSubmitSynthesisResult> {
    const c = this.bountyRW(bountyAddress);
    const tx = await c.submitSynthesis(synthesizerAgentId, reportRoot, {
      ...this.synthGasOpts,
      value: lzFeeWei,
    });
    const receipt = await tx.wait();

    let lzGuid: string | null = null;
    let lzNonce: bigint | null = null;
    let recipients: string[] = [];
    let amounts: bigint[] = [];
    const iface = new ethers.Interface(BOUNTY_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "PayoutDispatched") {
          lzGuid = parsed.args.lzGuid as string;
          lzNonce = parsed.args.nonce as bigint;
          recipients = parsed.args.recipients as string[];
          amounts = parsed.args.amounts as bigint[];
          break;
        }
      } catch {
        /* skip non-Bounty logs */
      }
    }

    return {
      txHash: tx.hash,
      lzGuid,
      lzNonce,
      lzFeePaid: lzFeeWei,
      recipients,
      amounts,
    };
  }

  // ----- internal -----

  private bountyRO(addr: string): any {
    return new ethers.Contract(addr, BOUNTY_ABI, this.provider);
  }

  private bountyRW(addr: string): any {
    return new ethers.Contract(addr, BOUNTY_ABI, this.wallet);
  }
}
