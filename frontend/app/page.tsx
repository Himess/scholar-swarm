import Nav from "@/components/Nav";
import SponsorStrip from "@/components/SponsorStrip";
import LiveBadge from "@/components/LiveBadge";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <section className="relative">
          <div className="hero-glow" />
          <div className="relative max-w-page mx-auto px-8 pt-20 pb-10">
            <div className="flex justify-center mb-6">
              <LiveBadge />
            </div>
            <div className="text-center mb-7">
              <div className="kicker mb-5">Post a research bounty</div>
              <h1 className="h-display" style={{ fontSize: "clamp(44px,5.4vw,72px)" }}>
                <span className="text-fg">Five specialist iNFT agents,</span>
                <br />
                <span className="text-accent">one verified report.</span>
              </h1>
              <p className="text-fg-dim text-[20px] max-w-[720px] mx-auto mt-6 leading-relaxed">
                Real source-fetching. Independent critic. TEE-attested inference. Cross-chain
                payouts in <span className="text-fg font-medium">0.7&nbsp;seconds</span>.
              </p>
            </div>

            {/* Form card */}
            <div
              className="max-w-[800px] mx-auto bg-bg-elev border border-soft rounded-xl p-8"
              style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,.6)" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="dot dot-mint pulse-mint" />
                  <span className="kicker-sm" style={{ color: "var(--mint)" }}>
                    Network ready · 0G Galileo
                  </span>
                </div>
                <div className="kicker-sm">draft · v1</div>
              </div>

              <label className="block mb-7">
                <div className="kicker mb-2 flex items-center justify-between">
                  <span>Research goal</span>
                  <span className="text-fg-faint normal-case tracking-normal font-mono">
                    prefilled · spike 18
                  </span>
                </div>
                <textarea
                  rows={4}
                  defaultValue="Compare the security models of LayerZero V2 and Wormhole as of 2026: how each handles message attestation, who runs the verifying nodes, and one concrete vulnerability disclosed against either in the past 18 months."
                />
              </label>

              <label className="block mb-7">
                <div className="kicker mb-2">Budget · USDC</div>
                <div className="flex items-stretch gap-3">
                  <div className="relative flex-1">
                    <input type="number" defaultValue={1} step={0.1} min={0} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[13px] text-fg-faint">
                      USDC
                    </span>
                  </div>
                  <div
                    className="hidden md:flex items-center px-4 font-mono text-[12px] text-fg-dim bg-code-bg rounded-lg border border-soft"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    paid in USDC on Base · settled by KeeperHub
                  </div>
                </div>
                <div className="md:hidden font-mono text-[12px] text-fg-dim mt-2">
                  paid in USDC on Base · settled by KeeperHub
                </div>
              </label>

              <details className="mb-7 bg-code-bg border border-soft rounded-lg">
                <summary className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="chev font-mono text-fg-faint">▸</span>
                    <span className="kicker" style={{ color: "var(--fg-dim)" }}>
                      Fee schedule
                    </span>
                  </div>
                  <span className="font-mono text-[12px] text-fg-faint">15 / 60 / 15 / 10</span>
                </summary>
                <div className="px-4 pb-4 pt-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Planner", "15%"],
                    ["Researchers", "60%"],
                    ["Critic", "15%"],
                    ["Synthesizer", "10%"],
                  ].map(([name, pct]) => (
                    <div key={name} className="bg-bg-elev rounded-md p-3 border border-soft">
                      <div className="kicker-sm">{name}</div>
                      <div className="font-mono text-fg text-[18px] mt-1">{pct}</div>
                    </div>
                  ))}
                </div>
              </details>

              <a
                href="/bounty/20"
                className="accent-glow w-full inline-flex items-center justify-center gap-2 rounded-lg py-4 text-[18px] font-semibold"
                style={{ background: "var(--accent)", color: "#1a1306" }}
              >
                Post bounty <span aria-hidden="true">→</span>
              </a>

              <div className="mt-4 flex items-center gap-2 font-mono text-[12px] text-fg-faint">
                <span
                  className="dot"
                  style={{
                    background: "var(--accent)",
                    boxShadow: "0 0 0 3px rgba(255,209,102,.15)",
                  }}
                />
                demo mode · clicking submit links to live bounty&nbsp;#20 on 0G Galileo
              </div>
            </div>

            {/* Trust strip */}
            <div className="max-w-[1100px] mx-auto mt-12 flex flex-wrap items-center justify-center gap-5">
              <span className="kicker-sm">Built with</span>
              <SponsorStrip size={28} showInfra />
            </div>

            {/* What happens next */}
            <div className="max-w-[1240px] mx-auto mt-20">
              <div className="grad-divider mb-12" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    n: 1,
                    kicker: "Plan & Bid",
                    title: "Decompose & auction",
                    body: "Planner agent decomposes your goal into atomic sub-tasks. Researcher iNFTs bid on-chain for each one.",
                  },
                  {
                    n: 2,
                    kicker: "Verify",
                    title: "Independent critic",
                    body: "Critic re-fetches every cited URL via SearXNG and runs an independent attested LLM check on each claim.",
                  },
                  {
                    n: 3,
                    kicker: "Pay",
                    title: "Cross-chain payout",
                    body: "Bounty contract fires LayerZero V2 to Base. KeeperHub distributes USDC to all five wallets in 0.7s.",
                  },
                ].map((s) => (
                  <div key={s.n} className="bg-bg-elev border border-soft rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="badge-num">{s.n}</span>
                      <span className="kicker">{s.kicker}</span>
                    </div>
                    <div className="text-fg font-semibold text-[20px] mb-2">{s.title}</div>
                    <p className="text-fg-dim leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
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
