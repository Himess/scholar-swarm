// Disclosure panel — explains which exact on-chain run is shown on this page
// and links out to the engineered-rejection verification artifact for full
// transparency. ETHGlobal judges value upfront disclosure of demo framing.

const REPO = "https://github.com/Himess/scholar-swarm";
const REJECTION_DOC = `${REPO}/blob/master/docs/demo-video/REJECTION_VERIFICATION_RESULT.md`;

export default function AboutThisRun() {
  return (
    <div className="bg-bg-elev border border-soft rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="dot"
          style={{
            background: "var(--accent)",
            boxShadow: "0 0 0 3px rgba(255,209,102,.15)",
          }}
        />
        <div className="kicker">About this run</div>
      </div>

      <div className="text-fg-dim leading-relaxed text-[15px] space-y-3">
        <p>
          The data shown on this page is from the original{" "}
          <span className="text-fg font-medium">Spike 18 PASS run</span> on 0G Galileo —
          a clean end-to-end execution where all three sub-tasks were approved by the Critic
          and the Synthesizer fired the LayerZero V2 message atomically.
        </p>

        <p>
          The demo video <em>also</em> shows the Critic rejecting a finding for one sub-task. That
          scene is captured from a separate{" "}
          <span className="text-fg font-medium">Spike 18 reject-verification run</span>, where a
          Researcher is forced (via{" "}
          <code className="font-mono text-[12px] text-mint bg-code-bg px-1.5 py-0.5 rounded">
            DEMO_REJECT_TASK_INDEX
          </code>{" "}
          env var) to emit a finding without a source URL. The Critic's rejection is genuine and
          on-chain; no contract code is modified for the demo.
        </p>

        <p className="font-mono text-[12px] text-fg-faint pt-2 border-t border-soft">
          Full procedure + on-chain proof:{" "}
          <a
            href={REJECTION_DOC}
            target="_blank"
            rel="noopener noreferrer"
            className="ext-link text-accent"
          >
            REJECTION_VERIFICATION_RESULT.md ↗
          </a>
        </p>
      </div>
    </div>
  );
}
