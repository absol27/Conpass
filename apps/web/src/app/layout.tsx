import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SyncProvider } from "@/components/SyncProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Conpass · KubeCon NA 2026",
  description: "Your guide to making conference simple. Plan your KubeCon: travel-aware schedule, live gap filling and hallway connections. Powered by Elasticsearch.",
  icons: { icon: "/tag/tag-wave.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. LanguageTool) add attributes to <html>.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Nav />
        <SyncProvider />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">{children}</main>
      </body>
    </html>
  );
}
