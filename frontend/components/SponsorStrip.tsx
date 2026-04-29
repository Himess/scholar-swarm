import { SPONSORS, INFRA } from "@/lib/demo-data";

interface SponsorStripProps {
  /** Logo pixel size. */
  size?: number;
  /** When true, also render the secondary infrastructure logos (LZ + SearXNG)
   *  with their own muted "Powered by" label. */
  showInfra?: boolean;
}

export default function SponsorStrip({ size = 28, showInfra = false }: SponsorStripProps) {
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-3">
        {SPONSORS.map((s) => (
          <div className="logo-tile" key={s.alt} title={s.alt}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt={s.alt}
              width={size}
              height={size}
              style={{ borderRadius: 6, display: "block" }}
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {showInfra && (
        <>
          <span
            className="kicker-sm"
            style={{ color: "var(--fg-faint)", letterSpacing: "0.14em" }}
          >
            · Powered by ·
          </span>
          <div className="flex items-center gap-3" style={{ opacity: 0.78 }}>
            {INFRA.map((s) => (
              <div className="logo-tile" key={s.alt} title={s.alt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={s.alt}
                  width={Math.round(size * 0.86)}
                  height={Math.round(size * 0.86)}
                  style={{ borderRadius: 6, display: "block" }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
