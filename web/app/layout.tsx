import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "@/components/JsonLd";
import { SiteNav } from "@/components/SiteNav";
import { cn } from "@/lib/utils";
import {
  faqJsonLd,
  siteMetadata,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/geo";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = siteMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <head>
        <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM context" />
      </head>
      <body>
        <JsonLd
          data={[softwareApplicationJsonLd(), webSiteJsonLd(), faqJsonLd()]}
        />
        <SiteNav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
