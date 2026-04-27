/**
 * Spike 5 — 0G Storage roundtrip
 *
 * Goal:
 *   - Upload a JSON blob via @0gfoundation/0g-ts-sdk
 *   - Capture merkle root + tx
 *   - Download by root, verify content matches
 *   - Record latency (write + read) and bytes
 *
 * Usage:
 *   pnpm spike:05
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { OGStorageProvider } from "@scholar-swarm/og-client";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main(): Promise<void> {
  console.log("=== Spike 5 — 0G Storage roundtrip ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const storage = new OGStorageProvider({
    rpcUrl: process.env["OG_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai",
    indexerRpc: process.env["OG_STORAGE_ENDPOINT"] ?? "https://indexer-storage-testnet-turbo.0g.ai",
    privateKey: must("DEMO_PLANNER_KEY"),
  });
  console.log("Storage provider ready.\n");

  const payload = {
    bountyId: "spike-5-test",
    goal: "Verify 0G Storage roundtrip from Scholar Swarm SDK",
    claims: [
      { text: "0G Storage uses merkle-rooted blobs.", confidence: 0.95 },
      { text: "Roundtrip latency is acceptable for our use case.", confidence: 0.7 },
    ],
    metadata: { ts: new Date().toISOString(), spike: 5 },
  };

  console.log("Step 1: putJSON…");
  const t0 = Date.now();
  const ref = await storage.putJSON(payload);
  const writeMs = Date.now() - t0;
  console.log(`  root: ${ref.id}`);
  console.log(`  uri:  ${ref.uri}`);
  console.log(`  bytes: ${ref.bytes}`);
  console.log(`  write latency: ${writeMs} ms\n`);

  console.log("Step 2: getJSON…");
  const t1 = Date.now();
  const recovered = await storage.getJSON<typeof payload>(ref);
  const readMs = Date.now() - t1;
  console.log(`  read latency: ${readMs} ms`);
  console.log(`  recovered.goal: ${recovered.goal}`);

  const same = JSON.stringify(payload) === JSON.stringify(recovered);
  console.log(`  roundtrip equal: ${same ? "✅" : "❌"}\n`);

  const artifact = {
    spike: "05-og-storage",
    runAt: new Date().toISOString(),
    storageRoot: ref.id,
    storageUri: ref.uri,
    writeLatencyMs: writeMs,
    readLatencyMs: readMs,
    bytes: ref.bytes,
    roundtripEqual: same,
  };
  await writeFile(join(ARTIFACT_DIR, "spike-05.json"), JSON.stringify(artifact, null, 2));
  console.log(`Artifact written: docs/spike-artifacts/spike-05.json`);

  console.log("\n=== Go/No-go Gate ===");
  if (!same) {
    console.error("❌ Roundtrip mismatch. Storage layer broken or eventual-consistency window too long.");
    process.exit(1);
  }
  console.log("✅ Spike 5 PASS — 0G Storage put/get + JSON roundtrip verified.");
}

main().catch((err: Error) => {
  console.error("\n❌ Spike 5 failed:");
  console.error(err);
  process.exit(1);
});
