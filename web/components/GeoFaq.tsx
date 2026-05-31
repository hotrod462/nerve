"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SITE_FAQ } from "@/lib/geo";
import { ChevronDownIcon } from "lucide-react";

/** Visible FAQ — complements JSON-LD for humans and generative-engine crawlers. */
export function GeoFaq() {
  return (
    <section
      className="space-y-3 border-t border-border pt-8"
      aria-labelledby="geo-faq-heading"
    >
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
          <div>
            <h2 id="geo-faq-heading" className="text-lg font-semibold tracking-tight">
              About Nerve
            </h2>
            <p className="text-sm text-muted-foreground">
              What this tool is, what the metrics mean, and what it is not.
            </p>
          </div>
          <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <dl className="space-y-4">
            {SITE_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="text-sm font-medium">{item.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
