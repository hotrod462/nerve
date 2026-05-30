import path from "path";
import { listRuns, readJsonFile, RUNS_DIR } from "@/lib/loadRun";

interface StimulusParcel {
  stimulus_ids: string[];
  data: number[][];
  n_parcels: number;
}

export default function MatrixPage() {
  const runs = listRuns().filter((r) => r.manifest.stimulus && !r.manifest.contrast);

  const matrixPath = path.join(RUNS_DIR, "stimulus_parcel.json");
  const matrix = readJsonFile<StimulusParcel>(matrixPath);

  if (runs.length === 0 && !matrix) {
    return (
      <div className="empty">
        <h1>Matrix explorer</h1>
        <p>Run predict + export-web on multiple tracks first.</p>
      </div>
    );
  }

  const ids = matrix?.stimulus_ids ?? runs.map((r) => r.manifest.stimulus?.id ?? r.id);
  const rows =
    matrix?.data ??
    runs.map((r) => {
      const p = readJsonFile<{ data: number[][] }>(
        path.join(r.webDir, "matrices", "parcel_time.json")
      );
      if (!p?.data) return [];
      return p.data.map((row) => row.reduce((a, b) => a + b, 0) / row.length);
    });

  const nParcels = matrix?.n_parcels ?? (rows[0]?.length ?? 100);

  return (
    <div>
      <h1>Matrix explorer</h1>
      <p style={{ color: "#9aa0a6" }}>
        Stimulus × parcel ({ids.length}×{nParcels})
      </p>

      <div className="card" style={{ marginTop: "1rem", overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr>
              <th style={{ padding: 4, textAlign: "left" }}>Stimulus</th>
              <th colSpan={Math.min(20, nParcels)} style={{ padding: 4 }}>
                Parcels (first 20)
              </th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id, ri) => (
              <tr key={id}>
                <td style={{ padding: 4, borderTop: "1px solid #2a2f3a" }}>{id}</td>
                {(rows[ri] ?? []).slice(0, 20).map((v, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: 4,
                      borderTop: "1px solid #2a2f3a",
                      background: `rgba(124, 172, 248, ${Math.min(1, Math.abs(v) * 5)})`,
                    }}
                  >
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: "2rem" }}>Stimulus similarity (L2)</h2>
      <div className="card">
        <SimilarityGrid ids={ids} rows={rows} />
      </div>
    </div>
  );
}

function SimilarityGrid({ ids, rows }: { ids: string[]; rows: number[][] }) {
  const n = ids.length;
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = rows[i] ?? [];
      const b = rows[j] ?? [];
      let s = 0;
      for (let k = 0; k < Math.min(a.length, b.length); k++) {
        const d = a[k] - b[k];
        s += d * d;
      }
      dist[i][j] = Math.sqrt(s);
    }
  }

  const max = Math.max(...dist.flat(), 1e-6);

  return (
    <table style={{ borderCollapse: "collapse", fontSize: "0.8rem" }}>
      <thead>
        <tr>
          <th />
          {ids.map((id) => (
            <th key={id} style={{ padding: 4, maxWidth: 80, overflow: "hidden" }}>
              {id.slice(0, 12)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ids.map((id, i) => (
          <tr key={id}>
            <td style={{ padding: 4 }}>{id.slice(0, 14)}</td>
            {ids.map((_, j) => (
              <td
                key={j}
                style={{
                  padding: 6,
                  background: `rgba(240, 120, 80, ${dist[i][j] / max})`,
                }}
                title={dist[i][j].toFixed(3)}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
