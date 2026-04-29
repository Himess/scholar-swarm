import Nav from "@/components/Nav";
import SponsorStrip from "@/components/SponsorStrip";
import AgentCard from "@/components/AgentCard";
import {
  AGENTS,
  AGENT_NFT_CONTRACT,
  REPUTATION_REGISTRY,
  ogAddr,
  truncAddr,
} from "@/lib/demo-data";

export const metadata = {
  title: "iNFT Agents · Scholar Swarm",
  description:
    "Five specialist iNFT agents minted on AgentNFT (ERC-7857 + ERC-8004). Each has its own operator wallet, on-chain reputation, and encrypted intelligence on 0G Storage.",
};

export default function AgentsPage() {
  return (
    <>
      <Nav />
      <main>
        <section>
          {/* Header band */}
          <div className="border-b border-soft">
            <div className="max-w-page mx-auto px-8 py-12">
              <div className="kicker mb-4">iNFT Gallery</div>
              <h1 className="font-bold h-tight text-fg" style={{ fontSize: "clamp(40px,5vw,64px)" }}>
                <span className="text-fg">Five specialist agents,</span>
                <br />
                <span className="text-accent">five distinct on-chain identities.</span>
              </h1>
              <p className="text-fg-dim text-[20px] max-w-[860px] mt-6 leading-relaxed">
                Each Scholar Swarm agent is minted as an{" "}
                <span className="text-fg font-medium">ERC-7857 iNFT</span> on 0G Galileo, with
                its role definition <span className="text-mint">AES-256-GCM encrypted</span> on
                0G Storage and the merkle root committed on-chain. After mint, each iNFT was
                redistributed to a separate operator wallet — proving that the swarm runs across
                five truly independent signers.
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="bg-bg-elev border-b border-soft">
            <div
              className="max-w-page mx-auto px-8 grid grid-cols-1 md:grid-cols-4 md:divide-x"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="py-5 md:pr-8">
                <div className="kicker mb-1">AgentNFT contract</div>
                <a
                  href={ogAddr(AGENT_NFT_CONTRACT)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ext-link font-mono text-[14px] text-fg break-all hover:underline"
                >
                  {truncAddr(AGENT_NFT_CONTRACT)} ↗
                </a>
                <div className="font-mono text-[11px] text-fg-faint mt-1">
                  ERC-7857 + ERC-8004 unified
                </div>
              </div>
              <div className="py-5 md:px-8 border-l border-soft">
                <div className="kicker mb-1">Reputation registry</div>
                <a
                  href={ogAddr(REPUTATION_REGISTRY)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ext-link font-mono text-[14px] text-fg break-all hover:underline"
                >
                  {truncAddr(REPUTATION_REGISTRY)} ↗
                </a>
                <div className="font-mono text-[11px] text-fg-faint mt-1">
                  ERC-8004 standard
                </div>
              </div>
              <div className="py-5 md:px-8 border-l border-soft">
                <div className="kicker mb-1">Encryption</div>
                <div className="font-mono text-[14px] text-fg">AES-256-GCM</div>
                <div className="font-mono text-[11px] text-fg-faint mt-1">
                  Intelligence sealed on 0G Storage
                </div>
              </div>
              <div className="py-5 md:pl-8 border-l border-soft">
                <div className="kicker mb-1">Royalty split</div>
                <div className="font-mono text-[14px] text-fg">95 / 5</div>
                <div className="font-mono text-[11px] text-fg-faint mt-1">
                  ERC-2981 · AgentRoyaltyVault
                </div>
              </div>
            </div>
          </div>

          {/* Cards grid */}
          <div className="max-w-page mx-auto px-8 py-14">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {AGENTS.map((a) => (
                <AgentCard key={a.agentId} agent={a} />
              ))}
            </div>
          </div>

          {/* Why this matters */}
          <div className="max-w-[1100px] mx-auto px-8 pb-20">
            <div className="bg-bg-elev border border-soft rounded-xl p-8">
              <div className="kicker mb-4">Why iNFTs and not just regular agents</div>
              <div className="text-fg-dim leading-relaxed text-[16px] space-y-3">
                <p>
                  Each agent's intelligence — the role-specific system prompt, decoder, fine-tuning
                  artifacts — is{" "}
                  <span className="text-fg">not stored in our application code</span>. It lives
                  encrypted on 0G Storage, and the merkle root is committed in the iNFT itself.
                  Anyone holding the iNFT can decrypt and run the agent; transferring the iNFT
                  transfers the right to operate that agent.
                </p>
                <p>
                  This is what makes the agent an asset, not just a service. It can be sold,
                  combined with other agents, or upgraded — and on-chain royalty splits
                  (ERC-2981, 95/5 owner/creator) flow on every paid use through{" "}
                  <span className="text-fg">AgentRoyaltyVault</span>.
                </p>
                <p className="font-mono text-[13px] text-fg-faint pt-2 border-t border-soft">
                  Standards used: ERC-7857 (intelligent NFTs), ERC-8004 (reputation), ERC-2981
                  (royalty). All implemented on 0G Galileo.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-soft" style={{ minHeight: 60 }}>
        <div className="max-w-page mx-auto px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="font-mono text-[12px] text-fg-faint tracking-[0.12em] uppercase">
            5 iNFTs · 5 operator wallets · 1 swarm
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
