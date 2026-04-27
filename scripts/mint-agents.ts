/**
 * Mint the 5 Scholar Swarm agents as ERC-7857 iNFTs on 0G Galileo.
 *
 * For each role:
 *   1. Build the agent's "intelligence" JSON (system prompt + role spec).
 *   2. Encrypt with AES-256-GCM (random key+iv).
 *   3. Upload ciphertext to 0G Storage → merkle root committed on-chain.
 *   4. Call AgentNFT.mintAgent(to, role, root, encKeyBlob, uri, metadata).
 *   5. Capture agentId from Registered event, write deployment artifact.
 *
 * For hackathon simplicity, the encryption key is bundled raw inside the
 * iNFT's encryptedKey field — production replaces this with TEE-bound
 * re-encryption on transfer (see PLAN.md §10).
 *
 * Usage:
 *   pnpm exec tsx --env-file=.env scripts/mint-agents.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, createCipheriv } from "node:crypto";

import { ethers } from "ethers";

import { OGStorageProvider } from "@scholar-swarm/og-client";

const ARTIFACT_DIR = join(process.cwd(), "docs", "spike-artifacts");

// Role enum values must match contracts/src/interfaces/IAgentNFT.sol
const Role = {
  Planner: 0,
  Researcher: 1,
  Critic: 2,
  Synthesizer: 3,
} as const;

const AGENT_NFT_ABI = [
  "function mintAgent(address to, uint8 role, bytes32 intelligenceRoot, bytes encryptedKey, string agentURI, (string metadataKey, bytes metadataValue)[] metadata) payable returns (uint256)",
  "function totalAgents() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function intelligenceRoot(uint256) view returns (bytes32)",
  "function roleOf(uint256) view returns (uint8)",
  "event AgentMinted(uint256 indexed agentId, address indexed creator, uint8 indexed role, bytes32 intelligenceRoot, string agentURI)",
];

interface AgentSpec {
  name: string;
  role: number;
  systemPrompt: string;
  description: string;
  reputationSeed: { count: number; avg: number };
}

const AGENT_SPECS: AgentSpec[] = [
  {
    name: "Planner-Alpha",
    role: Role.Planner,
    systemPrompt:
      "You are the Planner agent in Scholar Swarm. Decompose research goals into 3 specific, non-overlapping sub-questions. Always return JSON arrays of 3 strings.",
    description:
      "Decomposes a research bounty into 3 sub-questions, awards them to researchers via reputation-weighted bid selection.",
    reputationSeed: { count: 0, avg: 0 },
  },
  {
    name: "Researcher-One",
    role: Role.Researcher,
    systemPrompt:
      "You are a Researcher agent in Scholar Swarm. Given a sub-question and source excerpts, produce JSON claims grounded in the sources. Each claim must cite at least one URL and quote a relevant excerpt.",
    description:
      "Performs retrieval-augmented research, produces source-attributed claims, stores findings on 0G Storage.",
    reputationSeed: { count: 12, avg: 0.83 },
  },
  {
    name: "Researcher-Two",
    role: Role.Researcher,
    systemPrompt:
      "You are a Researcher agent in Scholar Swarm. Same instructions as Researcher-One but with a slight bias toward shorter, denser claims.",
    description:
      "Newer researcher specialty: dense, terse claims preferred over verbose ones.",
    reputationSeed: { count: 4, avg: 0.95 },
  },
  {
    name: "Critic-Prime",
    role: Role.Critic,
    systemPrompt:
      "You are the Critic agent in Scholar Swarm. For each claim, decide whether the cited excerpt directly supports the claim. Return strict JSON. Be skeptical.",
    description:
      "Verifies researcher claims via HTTP source check + attested semantic match. Approves or rejects with rationale.",
    reputationSeed: { count: 20, avg: 0.88 },
  },
  {
    name: "Synthesizer-Final",
    role: Role.Synthesizer,
    systemPrompt:
      "You are the Synthesizer agent in Scholar Swarm. Integrate critic-approved findings into a coherent final report. Cite every statement back to the source URL.",
    description:
      "Aggregates approved findings into the final source-traceable research report on 0G Storage.",
    reputationSeed: { count: 8, avg: 4.4 },
  },
];

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function envOr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

interface MintResult {
  name: string;
  role: number;
  agentId: string;
  owner: string;
  intelligenceRoot: string;
  storageUri: string;
  ciphertextBytes: number;
  encryptionAlgo: string;
  txHash: string;
  explorer: string;
}

async function main() {
  console.log("=== Scholar Swarm — mint 5 agents as ERC-7857 iNFTs ===\n");
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rpcUrl = envOr("OG_RPC_URL", "https://evmrpc-testnet.0g.ai");
  const explorerUrl = envOr("OG_EXPLORER_URL", "https://chainscan-galileo.0g.ai");
  const privateKey = must("DEMO_PLANNER_KEY");
  const agentNftAddr = must("OG_AGENT_NFT");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer / minter: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} OG\n`);

  const agentNFT = new ethers.Contract(agentNftAddr, AGENT_NFT_ABI, wallet);
  console.log(`AgentNFT: ${agentNftAddr}`);
  const totalBefore = (await agentNFT["totalAgents"]!()) as bigint;
  console.log(`totalAgents before: ${totalBefore}\n`);

  // Owner addresses — one per agent in the demo. If unset, all to deployer.
  const owners = [
    envOr("PLANNER_OPERATOR_WALLET", wallet.address),
    envOr("RESEARCHER_1_OPERATOR_WALLET", wallet.address),
    envOr("RESEARCHER_2_OPERATOR_WALLET", wallet.address),
    envOr("CRITIC_OPERATOR_WALLET", wallet.address),
    envOr("SYNTHESIZER_OPERATOR_WALLET", wallet.address),
  ];

  const storage = new OGStorageProvider({ rpcUrl, privateKey });
  console.log("0G Storage provider ready.\n");

  const results: MintResult[] = [];

  for (let i = 0; i < AGENT_SPECS.length; i++) {
    const spec = AGENT_SPECS[i]!;
    const owner = owners[i]!;
    console.log(`──── Minting agent ${i + 1}/5: ${spec.name} (role=${spec.role}) ────`);

    // 1. Build intelligence payload.
    const intelligence = {
      version: "1.0",
      name: spec.name,
      role: spec.role,
      description: spec.description,
      systemPrompt: spec.systemPrompt,
      reputationSeed: spec.reputationSeed,
      framework: "@scholar-swarm/sdk",
      mintedAt: new Date().toISOString(),
    };
    const plaintext = Buffer.from(JSON.stringify(intelligence), "utf8");

    // 2. Encrypt with AES-256-GCM.
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const sealed = Buffer.concat([iv, tag, ciphertext]); // length-prefixed implicitly: iv=12, tag=16, then ct

    // For hackathon: bundle the symmetric key in encryptedKey blob raw.
    // Production: re-encrypt to owner's pubkey via TEE oracle (StubVerifier slot).
    const encryptedKeyBlob = key; // 32 bytes

    console.log(`  plaintext: ${plaintext.length} bytes`);
    console.log(`  ciphertext: ${sealed.length} bytes (iv|tag|ct)`);

    // 3. Upload ciphertext to 0G Storage.
    const ref = await storage.put(new Uint8Array(sealed), { contentType: "application/octet-stream" });
    console.log(`  storage root: ${ref.id}`);
    console.log(`  storage uri:  ${ref.uri}`);

    // 4. Mint iNFT.
    const tx = await agentNFT["mintAgent"]!(
      owner,
      spec.role,
      ref.id, // bytes32
      "0x" + encryptedKeyBlob.toString("hex"),
      ref.uri ?? `0gstorage://${ref.id}`,
      [],
      { value: 0 },
    );
    console.log(`  mint tx: ${tx.hash}`);
    const receipt = await tx.wait();

    // 5. Recover agentId from event.
    const totalNow = (await agentNFT["totalAgents"]!()) as bigint;
    const agentId = totalNow.toString();
    const ownerOnChain = (await agentNFT["ownerOf"]!(agentId)) as string;

    const explorer = `${explorerUrl}/tx/${tx.hash}`;
    console.log(`  agentId: ${agentId}  owner: ${ownerOnChain}`);
    console.log(`  ✓ minted at block ${receipt.blockNumber}\n`);

    results.push({
      name: spec.name,
      role: spec.role,
      agentId,
      owner: ownerOnChain,
      intelligenceRoot: ref.id,
      storageUri: ref.uri ?? `0gstorage://${ref.id}`,
      ciphertextBytes: sealed.length,
      encryptionAlgo: "AES-256-GCM",
      txHash: tx.hash,
      explorer,
    });
  }

  // 6. Write deployment artifact.
  const artifact = {
    mintedAt: new Date().toISOString(),
    agentNFT: agentNftAddr,
    chainId: 16602,
    explorerBase: explorerUrl,
    minter: wallet.address,
    agents: results,
  };
  const artifactPath = join(ARTIFACT_DIR, "minted-agents.json");
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: ${artifactPath}`);

  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(`  ${r.name.padEnd(20)} agentId=${r.agentId} root=${r.intelligenceRoot.slice(0, 14)}…`);
  }
  console.log(`\n✅ Minted ${results.length} iNFTs on 0G Galileo.`);
  console.log(`   AgentNFT: ${agentNftAddr}`);
  console.log(`   Explorer: ${explorerUrl}/address/${agentNftAddr}`);
}

main().catch((err: Error) => {
  console.error("\n❌ Mint failed:");
  console.error(err);
  process.exit(1);
});
