import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0c",
        "bg-elev": "#14141a",
        "bg-elev-2": "#181820",
        fg: "#f4f4f5",
        "fg-dim": "#a1a1aa",
        "fg-faint": "#52525b",
        accent: "#ffd166",
        mint: "#06d6a0",
        red: "#ef4444",
        blue: "#60a5fa",
        border: "#2a2a32",
        "code-bg": "#1a1a22",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-jbm)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.025em",
        kicker: "0.14em",
      },
      maxWidth: {
        page: "1640px",
        timeline: "1400px",
      },
    },
  },
  plugins: [],
};

export default config;
