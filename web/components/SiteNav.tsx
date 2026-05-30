"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Gallery" },
  { href: "/compare", label: "Compare" },
  { href: "/matrix", label: "Matrix" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link
          href="/"
          className="mr-4 text-sm font-semibold tracking-tight text-foreground hover:no-underline"
        >
          Nerve
        </Link>
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                active && "bg-muted text-foreground"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
