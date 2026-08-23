// SETUP: code "app/layout.tsx"

import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import "./opulence-theme.css";
import "./opulence-components.css";
import "./opulence-home.css";
import "./opulence-family-hero.css";
import "./service-art.css";

import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import Toaster from "@/components/Toaster";
import RatingGate from "@/components/RatingGate";
import SupportChat from "@/components/SupportChat";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Opulence Bliss — home cleaning & massage in London",
  description: "Vetted cleaners and massage therapists at your home across London.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.className} ${nunito.variable}`} suppressHydrationWarning>
      <body>
        <TopBar />
        <SiteHeader />
        {children}
        <Toaster />
        <RatingGate />
        <SupportChat />
      </body>
    </html>
  );
}
