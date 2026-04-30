import Link from "next/link";
import Nav from "@/components/Nav";
import SponsorStrip from "@/components/SponsorStrip";
import Timeline from "@/components/Timeline";
import TxChip from "@/components/TxChip";
import CrossChainPanel from "@/components/CrossChainPanel";
import RecipientCard from "@/components/RecipientCard";
import AboutThisRun from "@/components/AboutThisRun";
import { BOUNTY, ogAddr, truncAddr } from "@/lib/demo-data";

export default function BountyDetailPage() {
  return (
    <>
      <Nav />
      <main>
        <section>
          {/* Header band */}
          <div className="border-b border-soft">
            <div className="max-w-page mx-auto px-8 py-7">
              <div className="flex items-center justify-between gap-4 font-mono text-[12px] text-fg-faint mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Link href="/" className="ext-link">←</Link>
                  <Link href="/" className="ext-link uppercase tracking-[0.14em]">Bounties</Link>
                  <span>·</span>
                  <span className="text-fg-dim">#{BOUNTY.id} (canonical PASS run)</span>
                </div>
                <a
                  href="https://chainscan-galileo.0g.ai/address/0xA0b83019181144529d202baa2E7391E42c4C9502"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ext-link tracking-[0.06em]"
                  title="Latest cron-driven bounty on the live VPS swarm"
                >
                  See latest cron run · #26 ↗
                </a>
              </div>

              <div className="flex items-start justify-between gap-8 flex-wrap">
                <div className="flex-1 min-w-[420px]">
                  <div className="kicker-sm mb-2" style={{ color: "var(--fg-faint)" }}>Research goal</div>
                  <h1
                    className="text-[28px] font-semibold h-tight text-fg leading-snug max-w-[920px]"
                  >
                    {BOUNTY.goal}
                  </h1>
                </div>
                <div className="text-right">
                  <div className="pill-completed inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[14px] tracking-[0.12em] uppercase font-medium">
                    <span className="dot dot-mint" /> Completed
                  </div>
                  <div className="font-mono text-[13px] text-fg-dim mt-3">
                    {BOUNTY.wallClock} · {BOUNTY.totalTx} tx · {BOUNTY.distinctSigners} signers
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meta bar */}
          <div className="bg-bg-elev border-b border-soft">
            <div
              className="max-w-page mx-auto px-8 grid grid-cols-1 md:grid-cols-3 md:divide-x"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="py-5 md:pr-8">
                <div className="kicker mb-1">Budget</div>
                <div className="text-fg font-semibold text-[24px] font-mono tracking-tight">
                  {BOUNTY.budgetUSDC}{" "}
                  <span className="text-fg-dim text-[16px] font-normal">USDC</span>
                </div>
                <div className="font-mono text-[12px] text-fg-dim mt-1">
                  paid · Base Sepolia · KH-signed
                </div>
              </div>
              <div className="py-5 md:px-8 border-l border-soft">
                <div className="kicker mb-1">Bounty ID</div>
                <div className="font-semibold text-[24px] font-mono tracking-tight">#{BOUNTY.id}</div>
                <div className="font-mono text-[12px] text-fg-dim mt-1 flex items-center gap-2">
                  <a
                    href={ogAddr(BOUNTY.contract)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ext-link"
                  >
                    {truncAddr(BOUNTY.contract)}
                  </a>
                  <button className="copy-btn" title="copy" aria-label="copy contract">
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x={9} y={9} width={13} height={13} rx={2} />
                      <path d="M5 15V5a2 2 0 012-2h10" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="py-5 md:pl-8 border-l border-soft">
                <div className="kicker mb-1">LZ V2 GUID</div>
                <div className="font-semibold text-[24px] font-mono tracking-tight">
                  0x0c6eb880…6ad
                </div>
                <div className="font-mono text-[12px] text-fg-dim mt-1">
                  0G → Base · DVN-attested · ~40s
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="max-w-timeline mx-auto px-8 pt-16 pb-10">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="kicker mb-2">Lifecycle</div>
                <h2 className="text-[28px] font-semibold h-tight">Bounty.sol state transitions</h2>
              </div>
              <div className="font-mono text-[12px] text-fg-faint hidden md:block">
                5 / 5 stages · Bounty.sol on 0G Galileo
              </div>
            </div>

            <Timeline />

            <div className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <div className="kicker">Stage transactions · 0G Galileo</div>
                <div className="font-mono text-[12px] text-fg-faint">scroll →</div>
              </div>
              <TxChip />
            </div>
          </div>

          {/* Cross-chain payout */}
          <div className="max-w-page mx-auto px-8 mt-6">
            <CrossChainPanel />
          </div>

          {/* Recipients */}
          <div className="max-w-page mx-auto px-8 mt-14">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="kicker mb-2">Recipient wallets</div>
                <h2 className="text-[28px] font-semibold h-tight">
                  Five iNFT operators · paid in one tx
                </h2>
              </div>
              <div className="font-mono text-[12px] text-fg-faint hidden md:block">
                delta source · 0xa06717e4…f0b7
              </div>
            </div>
            <RecipientCard />
          </div>

          {/* About this run — disclosure of demo framing */}
          <div className="max-w-[1100px] mx-auto px-8 mt-14">
            <AboutThisRun />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-soft mt-16" style={{ minHeight: 60 }}>
        <div className="max-w-page mx-auto px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="font-mono text-[12px] text-fg-faint tracking-[0.12em] uppercase">
            20 / 20 spikes pass · live data from Spike 18 + Spike 19 + Spike 20
          </div>
          <div className="flex items-center gap-3">
            <span className="kicker-sm">Built with</span>
            <SponsorStrip size={22} showInfra />
          </div>
        </div>
      </footer>
    </>
  );
}
