import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Gallery</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/matrix">Matrix</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
