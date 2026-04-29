import { baseTx, finalReportRoot, khDistributeTx, lzGuid } from "@/lib/demo-data";

export default function CrossChainPanel() {
  return (
    <div
      className="bg-bg-elev border border-soft rounded-2xl p-8"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,.5)" }}
    >
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="kicker mb-2">Cross-chain payout</div>
          <h2 className="text-[28px] font-semibold h-tight">
            0G → Base via LayerZero V2 · settled by KeeperHub
          </h2>
        </div>
        <div className="pill-paid inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[14px] tracking-[0.12em] uppercase font-medium">
          <span className="dot dot-mint" /> Paid · 0.7s
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-stretch">
        {/* Source: 0G */}
        <div className="bg-bg-elev-2 border border-soft rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="logo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://unavatar.io/twitter/0g_labs"
                alt="0G"
                width={28}
                height={28}
                style={{ borderRadius: 6 }}
              />
            </div>
            <div>
              <div className="kicker-sm">Source · 0G Galileo</div>
              <div className="font-semibold text-fg">Bounty.submitSynthesis</div>
            </div>
          </div>
          <div className="bg-code-bg rounded-lg p-4 border border-soft">
            <div className="kicker-sm mb-1">Final report root · 0G Storage</div>
            <div className="font-mono text-[13px] text-fg-dim break-all">{finalReportRoot}</div>
          </div>
          <div className="bg-code-bg rounded-lg p-4 border border-soft mt-3">
            <div className="kicker-sm mb-1">LZ V2 message GUID</div>
            <div className="font-mono text-[13px] text-blue break-all">{lzGuid}</div>
          </div>
        </div>

        {/* Arrow */}
        <div
          className="hidden lg:flex flex-col items-center justify-center"
          style={{ minWidth: 160 }}
        >
          <div className="kicker-sm mb-3" style={{ color: "var(--blue)" }}>LayerZero V2</div>
          <div className="lz-arrow w-full" />
          <div className="font-mono text-[12px] text-fg-dim mt-3">DVN-attested · ~40s</div>
        </div>
        <div className="flex lg:hidden flex-col items-center" style={{ height: 40 }}>
          <div className="lz-arrow-v h-full" />
        </div>

        {/* Dest: Base / KH */}
        <div className="bg-bg-elev-2 border border-soft rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="logo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://unavatar.io/twitter/keeperhubapp"
                alt="KH"
                width={28}
                height={28}
                style={{ borderRadius: 6 }}
              />
            </div>
            <div>
              <div className="kicker-sm">Destination · Base Sepolia</div>
              <div className="font-semibold text-fg">PaymentMessenger → PaymentRouter.distribute</div>
            </div>
          </div>
          <div className="bg-code-bg rounded-lg p-4 border border-soft">
            <div className="kicker-sm mb-1">distribute tx · Base Sepolia</div>
            <a
              href={baseTx(khDistributeTx)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[13px] text-mint break-all hover:underline"
            >
              {khDistributeTx} ↗
            </a>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-code-bg rounded-lg p-3 border border-soft">
              <div className="kicker-sm">Recipients</div>
              <div className="font-mono text-fg text-[18px] mt-1">5</div>
            </div>
            <div className="bg-code-bg rounded-lg p-3 border border-soft">
              <div className="kicker-sm">USDC sent</div>
              <div className="font-mono text-fg text-[18px] mt-1">1.000000</div>
            </div>
            <div className="bg-code-bg rounded-lg p-3 border border-soft">
              <div className="kicker-sm">Settlement</div>
              <div className="font-mono text-mint text-[18px] mt-1">0.7s</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
