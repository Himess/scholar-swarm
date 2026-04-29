import { TX_CHIPS, ogTx, truncHash } from "@/lib/demo-data";

export default function TxChip() {
  return (
    <div className="x-scroll overflow-x-auto pb-3">
      <div className="flex gap-4 min-w-max">
        {TX_CHIPS.map((c) => (
          <div
            key={c.label}
            className="chip-hover bg-bg-elev border border-soft rounded-xl p-5"
            style={{ minWidth: 300 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-fg">{c.label}</span>
              <span className="font-mono text-[12px] text-fg-dim">{c.t}</span>
            </div>
            <div className="font-mono text-[13px] text-fg-dim mb-1">
              {c.actor} · <span className="text-fg">{c.addr}</span>
            </div>
            <div className="font-mono text-[12px] text-fg-faint mb-4 break-all">
              {truncHash(c.hash)}
            </div>
            <a
              href={ogTx(c.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="ext-link font-mono text-[12px] tracking-[0.1em] uppercase"
            >
              ↗ View on 0gscan
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
