"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { MeshBundle } from "@/components/BrainViewer";

const BrainViewer = dynamic(
  () => import("@/components/BrainViewer").then((m) => m.BrainViewer),
  { ssr: false }
);

function runMeshBundle(id: string): { lh: string; rh: string; mesh: MeshBundle } {
  const base = `/api/runs/${id}`;
  return {
    lh: `${base}/mesh/lh.inflated.gii`,
    rh: `${base}/mesh/rh.inflated.gii`,
    mesh: {
      surfaces: {
        pial: { lh: `${base}/mesh/lh.pial.gii`, rh: `${base}/mesh/rh.pial.gii` },
        half: { lh: `${base}/mesh/lh.half.gii`, rh: `${base}/mesh/rh.half.gii` },
        inflated: { lh: `${base}/mesh/lh.inflated.gii`, rh: `${base}/mesh/rh.inflated.gii` },
      },
      activations: {
        lh: `${base}/mesh/lh.activations.gii`,
        rh: `${base}/mesh/rh.activations.gii`,
      },
      sulc: {
        lh: `${base}/mesh/lh.sulc.gii`,
        rh: `${base}/mesh/rh.sulc.gii`,
      },
    },
  };
}

export function CompareClient({
  runA,
  runB,
  contrastId,
}: {
  runA: string;
  runB: string;
  contrastId?: string;
}) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  const a = runMeshBundle(runA);
  const b = runMeshBundle(runB);
  const c = contrastId ? runMeshBundle(contrastId) : null;

  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="grid-2">
        <div className="card">
          <h3>{runA}</h3>
          <BrainViewer
            lhMeshUrl={a.lh}
            rhMeshUrl={a.rh}
            mesh={a.mesh}
            frame={frame}
            onFrameChange={setFrame}
            playing={playing}
            onPlayingChange={setPlaying}
            height={320}
          />
        </div>
        <div className="card">
          <h3>{runB}</h3>
          <BrainViewer
            lhMeshUrl={b.lh}
            rhMeshUrl={b.rh}
            mesh={b.mesh}
            frame={frame}
            onFrameChange={setFrame}
            playing={playing}
            onPlayingChange={setPlaying}
            height={320}
          />
        </div>
      </div>
      {c && (
        <div className="card">
          <h3>A − B contrast</h3>
          <BrainViewer
            lhMeshUrl={c.lh}
            rhMeshUrl={c.rh}
            mesh={c.mesh}
            colormap="cold_hot"
            frame={frame}
            onFrameChange={setFrame}
            playing={playing}
            onPlayingChange={setPlaying}
            height={320}
          />
        </div>
      )}
      {!contrastId && (
        <p style={{ color: "#9aa0a6" }}>
          Run <code>nerve contrast</code> + <code>export-web</code> for a contrast bundle.
        </p>
      )}
    </div>
  );
}
