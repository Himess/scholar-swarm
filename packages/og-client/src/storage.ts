/**
 * 0G Storage → StorageProvider adapter.
 *
 * Wraps `@0gfoundation/0g-ts-sdk`. Uses MemData for in-memory uploads
 * (claims JSON, findings JSON, final reports). Each upload returns a
 * merkle root committed to 0G Storage; we surface that as the StorageRef id.
 */

import { ethers } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";

import type { StorageProvider, StorageRef } from "@scholar-swarm/sdk";

export interface OGStorageConfig {
  rpcUrl?: string;
  indexerRpc?: string;
  privateKey: string;
}

export class OGStorageProvider implements StorageProvider {
  readonly name = "0g-storage";

  private readonly rpc: string;
  private readonly signer: ethers.Wallet;
  private readonly indexer: Indexer;

  constructor(cfg: OGStorageConfig) {
    this.rpc = cfg.rpcUrl ?? "https://evmrpc-testnet.0g.ai";
    const indexerRpc = cfg.indexerRpc ?? "https://indexer-storage-testnet-turbo.0g.ai";
    const provider = new ethers.JsonRpcProvider(this.rpc);
    this.signer = new ethers.Wallet(cfg.privateKey, provider);
    this.indexer = new Indexer(indexerRpc);
  }

  async put(data: Uint8Array): Promise<StorageRef> {
    const memData = new MemData(data);
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr || !tree) throw new Error(`merkleTree failed: ${treeErr}`);
    const root = tree.rootHash() as string;

    // ethers ESM/CJS dual-resolution boundary: types disagree, runtime is identical.
    const [, uploadErr] = await this.indexer.upload(memData, this.rpc, this.signer as any);
    if (uploadErr) throw new Error(`upload failed: ${uploadErr}`);

    return { id: root, uri: `0gstorage://${root}`, bytes: data.byteLength };
  }

  async get(ref: StorageRef): Promise<Uint8Array> {
    // 0G TS SDK download writes to disk; for in-memory consumers we'd need a
    // `downloadToBuffer`-like helper. For now, write to a temp file then read.
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmp = path.join(os.tmpdir(), `og-storage-${ref.id}.bin`);
    const err = await this.indexer.download(ref.id, tmp, true);
    if (err) throw new Error(`download failed: ${String(err)}`);
    return new Uint8Array(await fs.readFile(tmp));
  }

  async putJSON<T>(value: T): Promise<StorageRef> {
    const data = new TextEncoder().encode(JSON.stringify(value));
    return this.put(data);
  }

  async getJSON<T>(ref: StorageRef): Promise<T> {
    const data = await this.get(ref);
    return JSON.parse(new TextDecoder().decode(data)) as T;
  }
}
