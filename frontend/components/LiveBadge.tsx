"use client";

import { useEffect, useState } from "react";

const VPS_RUNS_URL =
  "https://raw.githubusercontent.com/Himess/scholar-swarm/master/docs/vps-runs/latest.json";

interface LiveRun {
  vpsHost: string;
  lastSuccessful: {
    bountyId: number;
    bountyAddress: string;
    completedAt: string;
    elapsedSeconds: number;
    finalReportRoot: string;
    explorer: string;
  };
}

function relTime(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) {
    const h = Math.floor(d / 3600);
    const m = Math.round((d - h * 3600) / 60);
    return `${h}h ${m}m ago`;
  }
  return `${Math.floor(d / 86400)}d ago`;
}

export default function LiveBadge() {
  const [data, setData] = useState<LiveRun | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(VPS_RUNS_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LiveRun;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    };
    void load();
    const t = setInterval(load, 60_000); // refresh every minute
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (err) {
    return null; // Fail silently — badge is supplementary, never block the page
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-elev border border-soft text-fg-faint font-mono text-[12px]">
        <span className="dot" style={{ background: "var(--fg-faint)" }} />
        Live status loading…
      </div>
    );
  }

  const { lastSuccessful, vpsHost } = data;

  return (
    <a
      href={lastSuccessful.explorer}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 px-3 py-1.5 rounded-full bg-bg-elev border border-soft hover:border-accent transition-colors"
      title={`VPS host: ${vpsHost} · Bounty #${lastSuccessful.bountyId}`}
    >
      <span className="dot dot-mint pulse-mint" />
      <span className="font-mono text-[12px] text-fg-dim tracking-[0.06em]">
        VPS swarm live · last bounty <span className="text-fg">#{lastSuccessful.bountyId}</span>{" "}
        completed in{" "}
        <span className="text-mint">{Math.round(lastSuccessful.elapsedSeconds)}s</span>{" "}
        <span className="text-fg-faint">· {relTime(lastSuccessful.completedAt)} ↗</span>
      </span>
    </a>
  );
}
