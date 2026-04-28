/**
 * Spike 18 launcher — spawns 5 AXL nodes + 5 agent runtimes on the laptop,
 * then prints the swarm topology and idles until Ctrl-C.
 *
 * In a separate terminal, run `pnpm spike:18:cli` to actually post a bounty
 * and watch the swarm coordinate it end-to-end.
 *
 *   pnpm exec tsx --env-file=.env scripts/spike-18-launch.ts
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

interface NodeSpec {
  role: "planner" | "r1" | "r2" | "critic" | "synth";
  apiPort: number;
  cwd: string;
}

interface AgentSpec {
  role: string;
  pkg: "agent-planner" | "agent-researcher" | "agent-critic" | "agent-synthesizer";
  env: Record<string, string>;
}

const ROOT = process.cwd();
const LOG_DIR = join(ROOT, "logs", "spike-18");

const AXL_NODES: NodeSpec[] = [
  { role: "planner", apiPort: 9101, cwd: join(ROOT, "infra", "axl-node-planner") },
  { role: "r1", apiPort: 9102, cwd: join(ROOT, "infra", "axl-node-r1") },
  { role: "r2", apiPort: 9103, cwd: join(ROOT, "infra", "axl-node-r2") },
  { role: "critic", apiPort: 9104, cwd: join(ROOT, "infra", "axl-node-critic") },
  { role: "synth", apiPort: 9105, cwd: join(ROOT, "infra", "axl-node-synth") },
];

const AGENTS: AgentSpec[] = [
  {
    role: "planner",
    pkg: "agent-planner",
    // BID_WINDOW_MS: time the planner waits between broadcasting sub-tasks
    // and awarding bids. Each researcher places one placeBid per sub-task
    // sequentially (same-wallet nonce constraint). 0G testnet tx ~30s, so
    // 3 sub-tasks × 30s = ~90s per researcher. 120s window adds margin.
    env: { AXL_ENDPOINT: "http://127.0.0.1:9101", BID_WINDOW_MS: "120000" },
  },
  {
    role: "researcher-1",
    pkg: "agent-researcher",
    env: {
      RESEARCHER_NUMBER: "1",
      AXL_ENDPOINT_RESEARCHER_1: "http://127.0.0.1:9102",
    },
  },
  {
    role: "researcher-2",
    pkg: "agent-researcher",
    env: {
      RESEARCHER_NUMBER: "2",
      AXL_ENDPOINT_RESEARCHER_2: "http://127.0.0.1:9103",
    },
  },
  {
    role: "critic",
    pkg: "agent-critic",
    env: { AXL_ENDPOINT: "http://127.0.0.1:9104" },
  },
  {
    role: "synth",
    pkg: "agent-synthesizer",
    env: { AXL_ENDPOINT: "http://127.0.0.1:9105" },
  },
];

const procs: { name: string; child: ChildProcess }[] = [];

function spawnAxlNode(spec: NodeSpec): ChildProcess {
  const exe = join(spec.cwd, "node.exe");
  if (!existsSync(exe)) throw new Error(`AXL binary missing at ${exe}`);
  const out = spawn(exe, ["-config", "node-config.json"], {
    cwd: spec.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out;
}

function spawnAgent(spec: AgentSpec): ChildProcess {
  // Run tsx directly from node_modules — avoids depending on pnpm being on PATH
  // inside the child's shell (Git Bash / cmd.exe shells don't inherit user PATH).
  const tsxJs = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(
    process.execPath, // node binary
    [tsxJs, "--env-file=.env", `apps/${spec.pkg}/src/index.ts`],
    {
      cwd: ROOT,
      env: { ...process.env, ...spec.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return child;
}

function pipeChildLogs(name: string, child: ChildProcess, color: string): void {
  const reset = "\x1b[0m";
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`${color}[${name}]${reset} ${chunk.toString().trimEnd()}\n`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`${color}[${name}!]${reset} ${chunk.toString().trimEnd()}\n`);
  });
  child.on("exit", (code) => {
    process.stdout.write(`${color}[${name}]${reset} exited code=${code}\n`);
  });
}

async function waitForAxlMesh(): Promise<void> {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; ++i) {
    try {
      const res = await fetch("http://127.0.0.1:9101/topology");
      if (res.ok) {
        const data = (await res.json()) as { peers?: unknown[] };
        if (data.peers && data.peers.length >= 4) {
          console.log(`  ✓ AXL mesh formed: planner sees ${data.peers.length} peers`);
          return;
        }
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("  ⚠ planner /topology never showed 4+ peers; continuing anyway");
}

async function main(): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });

  console.log("=== Spike 18 launcher — 5 AXL nodes + 5 agent runtimes ===\n");

  // 1. Spawn all 5 AXL nodes.
  console.log("Step 1: spawning AXL nodes…");
  const colors = ["\x1b[36m", "\x1b[33m", "\x1b[35m", "\x1b[32m", "\x1b[34m"];
  for (let i = 0; i < AXL_NODES.length; ++i) {
    const spec = AXL_NODES[i]!;
    const child = spawnAxlNode(spec);
    procs.push({ name: `axl-${spec.role}`, child });
    pipeChildLogs(`axl-${spec.role}`, child, colors[i] ?? "\x1b[37m");
    console.log(`  • axl-${spec.role} pid=${child.pid} api=:${spec.apiPort}`);
  }

  // 2. Wait for mesh convergence (planner sees all 4 peers).
  console.log("\nStep 2: waiting for AXL mesh…");
  await waitForAxlMesh();

  // 3. Spawn agent runtimes.
  console.log("\nStep 3: spawning agent runtimes…");
  await new Promise((r) => setTimeout(r, 1000));
  for (let i = 0; i < AGENTS.length; ++i) {
    const spec = AGENTS[i]!;
    const child = spawnAgent(spec);
    procs.push({ name: spec.role, child });
    pipeChildLogs(spec.role, child, colors[i] ?? "\x1b[37m");
    console.log(`  • ${spec.role} pid=${child.pid} pkg=${spec.pkg}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n========================================================");
  console.log("Swarm is up. Run `pnpm spike:18:cli` in another terminal");
  console.log("to post a bounty. Ctrl-C here to bring everything down.");
  console.log("========================================================\n");

  const shutdown = (): void => {
    console.log("\nShutting down…");
    for (const p of procs) {
      try {
        p.child.kill("SIGTERM");
      } catch {
        /* */
      }
    }
    setTimeout(() => process.exit(0), 1500);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: Error) => {
  console.error("launcher crashed:", err);
  for (const p of procs) {
    try {
      p.child.kill("SIGTERM");
    } catch {
      /* */
    }
  }
  process.exit(1);
});
