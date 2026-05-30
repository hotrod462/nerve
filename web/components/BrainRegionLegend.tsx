"use client";

import type { NiivueLabelLut } from "@/lib/atlas";

export function BrainRegionLegend({
  lut,
  title,
  compact = false,
}: {
  lut: NiivueLabelLut;
  title: string;
  compact?: boolean;
}) {
  const indices = lut.I ?? lut.R.map((_, i) => i);
  const entries = indices
    .map((idx, i) => ({
      idx,
      label: lut.labels?.[i] ?? `Region ${idx}`,
      color: `rgb(${lut.R[i]}, ${lut.G[i]}, ${lut.B[i]})`,
    }))
    .filter((e) => e.idx > 0 && e.label && !e.label.startsWith("_"));

  if (entries.length === 0) return null;

  return (
    <div className="brain-region-legend" aria-label={title}>
      <span className="brain-region-legend__title">{title}</span>
      <ul
        className={`brain-region-legend__list${compact ? " is-compact" : ""}`}
      >
        {entries.map((e) => (
          <li key={e.idx} className="brain-region-legend__item">
            <span
              className="brain-region-legend__swatch"
              style={{ background: e.color }}
            />
            <span className="brain-region-legend__name">{e.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
