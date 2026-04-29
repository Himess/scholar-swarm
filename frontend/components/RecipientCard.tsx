import { baseTx, khDistributeTx, RECIPIENTS } from "@/lib/demo-data";

export default function RecipientCard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {RECIPIENTS.map((r) => (
        <div key={r.n} className="bg-bg-elev border border-soft rounded-xl p-5 chip-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-[18px]">{r.role}</div>
            <span className="badge-num">{r.n}</span>
          </div>
          <div className="bg-code-bg rounded-md p-3 border border-soft mb-4">
            <div className="kicker-sm mb-1">Operator wallet</div>
            <div className="font-mono text-[12px] text-fg-dim break-all">{r.addr}</div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="font-mono font-semibold text-[20px] text-mint">
              {r.amt}{" "}
              <span className="text-[14px] text-fg-dim font-normal">USDC</span>
            </div>
            <a
              href={baseTx(khDistributeTx)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-fg-faint ext-link tracking-[0.1em] uppercase"
            >
              delta ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
