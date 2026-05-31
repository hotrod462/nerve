"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ENGAGEMENT_COLORS,
  ENGAGEMENT_NETWORK_ORDER,
  type EngagementData,
} from "@/lib/engagement";
import { ChevronDownIcon } from "lucide-react";

interface EngagementSummariesProps {
  engagement: EngagementData;
}

export function EngagementSummaries({ engagement }: EngagementSummariesProps) {
  return (
    <Collapsible defaultOpen={false} className="engagement-collapsible-section">
      <CollapsibleTrigger className="engagement-collapsible-section__trigger">
        <div className="engagement-collapsible-section__heading">
          <h3 className="engagement-summaries-block__title">Track summaries</h3>
          <p className="engagement-segments__hint">
            Active fraction and peak z-score per network for the full clip.
          </p>
        </div>
        <ChevronDownIcon className="engagement-row__chevron" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="engagement-collapsible-section__content">
        <div className="engagement-summaries-block">
          <div className="engagement-summaries">
            {ENGAGEMENT_NETWORK_ORDER.map((net) => {
              const summary = engagement.summaries[net];
              const trace = engagement.networks[net];
              if (!summary || !trace) return null;
              const color = ENGAGEMENT_COLORS[net] ?? "var(--foreground)";
              return (
                <div key={net} className="engagement-summaries__row">
                  <span
                    className="engagement-summaries__swatch"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="engagement-summaries__name">{trace.headline}</span>
                  <span
                    className="engagement-summaries__stat"
                    title="Active fraction (z > 0.5)"
                  >
                    active {Math.round(summary.active_fraction * 100)}%
                  </span>
                  <span className="engagement-summaries__stat" title="Peak z-score">
                    peak {summary.peak_z.toFixed(2)} @ {summary.peak_tr}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
