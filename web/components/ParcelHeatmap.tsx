"use client";

import type { ParcelTimeData } from "@/lib/parcels";

function scaleColor(v: number, vmin: number, vmax: number): string {
  const t = vmax > vmin ? (v - vmin) / (vmax - vmin) : 0.5;
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * clamped);
  const b = Math.round(255 * (1 - clamped));
  return `rgb(${r}, 40, ${b})`;
}

export function ParcelHeatmap({ parcel }: { parcel: ParcelTimeData }) {
  const flat = parcel.data.flat();
  const vmin = Math.min(...flat);
  const vmax = Math.max(...flat);
  const cols = parcel.n_trs;
  const rows = Math.min(parcel.n_parcels, 100);

  return (
    <div className="card" style={{ overflow: "auto" }}>
      <h3 style={{ marginTop: 0 }}>Parcel × time ({rows}×{cols})</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 4px)`,
          gridTemplateRows: `repeat(${rows}, 4px)`,
          gap: 0,
        }}
      >
        {parcel.data.slice(0, rows).map((row, ri) =>
          row.map((v, ci) => (
            <div
              key={`${ri}-${ci}`}
              title={`${parcel.labels[ri] ?? ri} t=${ci}`}
              style={{
                width: 4,
                height: 4,
                background: scaleColor(v, vmin, vmax),
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
