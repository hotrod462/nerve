"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { MeshBundle } from "@/components/BrainViewer";
import { runWebUrl } from "@/lib/assets";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BrainViewer = dynamic(
  () => import("@/components/BrainViewer").then((m) => m.BrainViewer),
  { ssr: false }
);

function runMeshBundle(id: string): { lh: string; rh: string; mesh: MeshBundle } {
  return {
    lh: runWebUrl(id, "mesh/lh.inflated.gii"),
    rh: runWebUrl(id, "mesh/rh.inflated.gii"),
    mesh: {
      surfaces: {
        pial: {
          lh: runWebUrl(id, "mesh/lh.pial.gii"),
          rh: runWebUrl(id, "mesh/rh.pial.gii"),
        },
        half: {
          lh: runWebUrl(id, "mesh/lh.half.gii"),
          rh: runWebUrl(id, "mesh/rh.half.gii"),
        },
        inflated: {
          lh: runWebUrl(id, "mesh/lh.inflated.gii"),
          rh: runWebUrl(id, "mesh/rh.inflated.gii"),
        },
      },
      activations: {
        lh: runWebUrl(id, "mesh/lh.activations.gii"),
        rh: runWebUrl(id, "mesh/rh.activations.gii"),
      },
      sulc: {
        lh: runWebUrl(id, "mesh/lh.sulc.gii"),
        rh: runWebUrl(id, "mesh/rh.sulc.gii"),
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
  const [playing, setPlaying] = useState(false);

  const a = runMeshBundle(runA);
  const b = runMeshBundle(runB);
  const c = contrastId ? runMeshBundle(contrastId) : null;

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-medium">{runA}</h2>
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
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-medium">{runB}</h2>
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
        </section>
      </div>
      {c && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">A − B contrast</h2>
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
        </section>
      )}
      {!contrastId && (
        <Alert>
          <AlertDescription>
            Run <code>nerve contrast</code> + <code>export-web</code> for a
            contrast bundle.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
