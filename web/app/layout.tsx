import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { MotionPreference } from "@/components/providers/MotionPreference";
import { CursorHost } from "@/components/cursor/CursorHost";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.product}`, template: `%s · ${BRAND.name}` },
  description: `${BRAND.tagline} ${BRAND.disclaimer}`,
  applicationName: BRAND.name,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`} suppressHydrationWarning>
      <body>
        <a
          href="#main"
          className="fixed left-4 top-4 z-(--z-loader) -translate-y-24 rounded-full bg-bone px-4 py-2 text-small font-medium text-graphite-950 transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <MotionPreference />
        {children}
        <CursorHost />
        <Toaster />
      </body>
    </html>
  );
}
