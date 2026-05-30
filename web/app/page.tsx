import Link from "next/link";
import { listRuns } from "@/lib/loadRun";

export default function GalleryPage() {
  const runs = listRuns().filter((r) => !r.manifest.contrast);

  if (runs.length === 0) {
    return (
      <div className="empty">
        <h1>Nerve gallery</h1>
        <p>No export bundles found.</p>
        <pre style={{ textAlign: "left", display: "inline-block", color: "#9aa0a6" }}>
          {`uv run nerve predict --audio stimuli/processed/musopen_egmont_45s.wav \\
  --out data/outputs/runs/egmont/
uv run nerve export-web --run data/outputs/runs/egmont/`}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <h1>Track gallery</h1>
      <p style={{ color: "#9aa0a6" }}>
        {runs.length} run{runs.length !== 1 ? "s" : ""} with web bundles
      </p>
      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        {runs.map((run) => (
          <Link key={run.id} href={`/tracks/${run.id}`} className="card">
            <strong>{run.manifest.stimulus?.id ?? run.id}</strong>
            {run.manifest.stimulus?.genre && (
              <span style={{ marginLeft: "0.5rem", color: "#9aa0a6" }}>
                {run.manifest.stimulus.genre}
              </span>
            )}
            <div style={{ fontSize: "0.85rem", marginTop: "0.25rem", color: "#9aa0a6" }}>
              T={run.manifest.T ?? "?"} · {run.manifest.device_report?.resolved ?? "—"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
