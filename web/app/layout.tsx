import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Nerve — TRIBE interpretability",
  description: "Niivue brain viewer for TRIBE v2 BOLD predictions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body>
        <SiteNav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
