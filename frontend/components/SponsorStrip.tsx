import { SPONSORS } from "@/lib/demo-data";

export default function SponsorStrip({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      {SPONSORS.map((s) => (
        <div className="logo-tile" key={s.alt} title={s.alt}>
          {/* Plain <img> — sponsor logos are external avatars */}
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
  );
}
