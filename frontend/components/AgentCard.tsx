import {
  type Agent,
  AGENT_NFT_CONTRACT,
  ogAddr,
  ogToken,
  ogTx,
  truncAddr,
  truncHash,
} from "@/lib/demo-data";

const ROLE_ICON: Record<Agent["role"], string> = {
  planner: "◆",
  researcher: "◇",
  critic: "✓",
  synthesizer: "★",
};

export default function AgentCard({ agent }: { agent: Agent }) {
  const initials = agent.name
    .split("-")
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="bg-bg-elev border border-soft rounded-2xl p-7 flex flex-col"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,.5)" }}
    >
      {/* Header — avatar + ID badge + role */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center font-mono font-bold text-[28px] rounded-2xl"
            style={{
              width: 80,
              height: 80,
              background: `linear-gradient(135deg, ${agent.accent}22, ${agent.accent}08)`,
              border: `1px solid ${agent.accent}55`,
              color: agent.accent,
            }}
          >
            {initials}
          </div>
          <div>
            <div className="kicker-sm" style={{ color: agent.accent }}>
              <span className="mr-1">{ROLE_ICON[agent.role]}</span>
              {agent.roleLabel}
            </div>
            <div className="text-fg font-semibold text-[24px] h-tight mt-1">
              {agent.name}
            </div>
            <div className="font-mono text-[12px] text-fg-faint mt-1">
              Agent #{agent.agentId} · ERC-7857 iNFT
            </div>
          </div>
        </div>

        <a
          href={ogToken(AGENT_NFT_CONTRACT, agent.agentId)}
          target="_blank"
          rel="noopener noreferrer"
          title={`View iNFT #${agent.agentId} on 0Gscan`}
          className="ext-link font-mono text-[11px] text-fg-faint hover:text-accent uppercase tracking-[0.1em]"
        >
          iNFT #{agent.agentId} ↗
        </a>
      </div>

      {/* Operator wallet */}
      <div className="bg-code-bg rounded-lg p-4 border border-soft mb-3">
        <div className="kicker-sm mb-1">Operator wallet</div>
        <a
          href={ogAddr(agent.operator)}
          target="_blank"
          rel="noopener noreferrer"
          className="ext-link font-mono text-[14px] text-fg break-all hover:underline"
        >
          {agent.operator}
        </a>
        <div className="font-mono text-[11px] text-fg-faint mt-1">
          Distinct on-chain identity · signs its own transactions
        </div>
      </div>

      {/* Encrypted intelligence */}
      <div className="bg-code-bg rounded-lg p-4 border border-soft mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="kicker-sm">Encrypted intelligence</div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(6,214,160,0.08)",
              color: "var(--mint)",
              border: "1px solid rgba(6,214,160,0.25)",
            }}
          >
            AES-256-GCM
          </div>
        </div>
        <div className="font-mono text-[12px] text-fg-dim break-all leading-snug">
          {agent.intelligenceRoot}
        </div>
        <div className="font-mono text-[11px] text-fg-faint mt-1">
          0G Storage · {agent.ciphertextBytes} bytes encrypted
        </div>
      </div>

      {/* Provenance row */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <a
          href={ogTx(agent.mintTx)}
          target="_blank"
          rel="noopener noreferrer"
          className="ext-link block bg-code-bg rounded-lg p-3 border border-soft hover:border-accent transition-colors"
        >
          <div className="kicker-sm">Mint tx</div>
          <div className="font-mono text-[12px] text-fg-dim mt-1">
            {truncHash(agent.mintTx)} ↗
          </div>
        </a>
        <a
          href={ogTx(agent.transferTx)}
          target="_blank"
          rel="noopener noreferrer"
          className="ext-link block bg-code-bg rounded-lg p-3 border border-soft hover:border-accent transition-colors"
        >
          <div className="kicker-sm">Transfer to operator</div>
          <div className="font-mono text-[12px] text-fg-dim mt-1">
            {truncHash(agent.transferTx)} ↗
          </div>
        </a>
      </div>
    </div>
  );
}
