"use client";

import {
  ENGAGEMENT_COLORS,
  ENGAGEMENT_NETWORK_ORDER,
  type EngagementData,
} from "@/lib/engagement";

interface EngagementSummariesProps {
  engagement: EngagementData;
}

export function EngagementSummaries({ engagement }: EngagementSummariesProps) {
  return (
    <div className="engagement-summaries-block">
      <h3 className="engagement-summaries-block__title">Track summaries</h3>
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
              <span className="engagement-summaries__stat" title="Active fraction (z > 0.5)">
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
  );
}
