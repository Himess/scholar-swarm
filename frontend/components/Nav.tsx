import Link from "next/link";

export default function Nav() {
  return (
    <header className="w-full border-b border-soft" style={{ height: 60 }}>
      <div className="max-w-page mx-auto h-full px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="inline-grid place-items-center w-7 h-7 rounded-md font-bold"
            style={{ background: "linear-gradient(135deg,#ffd166,#f4a13d)", color: "#1a1306" }}
          >
            S
          </span>
          <span className="font-semibold tracking-tight">SCHOLAR SWARM</span>
          <span className="hidden md:inline text-fg-dim text-sm pl-3 ml-1 border-l border-soft">
            AutoGPT for serious research.
          </span>
        </Link>
        <nav className="flex items-center gap-7 font-mono text-[13px] uppercase tracking-[0.14em]">
          <Link href="/" className="ext-link">Post</Link>
          <Link href="/bounty/20" className="ext-link">Bounty&nbsp;#20</Link>
          <Link href="/agents" className="ext-link">Agents</Link>
          <a
            href="https://github.com/Himess/scholar-swarm"
            target="_blank"
            rel="noopener noreferrer"
            className="ext-link"
          >
            Github&nbsp;↗
          </a>
        </nav>
      </div>
    </header>
  );
}
