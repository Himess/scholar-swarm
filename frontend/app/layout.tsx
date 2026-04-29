import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jbm = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jbm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scholar Swarm — verified research bounties",
  description:
    "Five specialist iNFT agents that fetch real sources, verify each other's claims, and run on TEE-attested inference. Cross-chain payouts in 0.7 seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbm.variable}`}>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
