"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addRegionLabelsToNiivue,
  loadRegionLabels,
  type MeshAtlasUrls,
} from "@/lib/atlas";
import { BrainColorbar } from "./BrainColorbar";
import { StimulusAudio } from "./StimulusAudio";
import { Timeline } from "./Timeline";

export type SurfaceMode = "pial" | "half" | "inflated";

export interface MeshBundle {
  surfaces?: Record<SurfaceMode, { lh: string; rh: string }>;
  activations?: { lh: string; rh: string };
  sulc?: { lh: string; rh: string };
  sulcRange?: { min: number; max: number };
  atlas?: MeshAtlasUrls;
}

export interface BrainViewerProps {
  lhMeshUrl: string;
  rhMeshUrl: string;
  mesh?: MeshBundle;
  defaultSurface?: SurfaceMode;
  stimulusAudioUrl?: string;
  colormap?: string;
  vmin?: number;
  vmax?: number;
  fps?: number;
  height?: number;
  frame?: number;
  onFrameChange?: (f: number) => void;
  playing?: boolean;
  onPlayingChange?: (p: boolean) => void;
  totalFrames?: number;
}

type NiivueInstance = InstanceType<typeof import("@niivue/niivue").Niivue>;

type LoadedCortexMesh = {
  id: string;
  type?: string;
  layers?: Array<{ nFrame4D?: number }>;
};

const SURFACE_LABELS: Record<SurfaceMode, string> = {
  pial: "Normal",
  half: "Smooth",
  inflated: "Inflated",
};

/** Meta-style white brain base color. */
const BRAIN_RGBA: [number, number, number, number] = [248, 248, 248, 255];

/** Meta-style ghost: semi-transparent inflated surface behind cortex. */
const FACE_OVERLAY_RGBA: [number, number, number, number] = [48, 50, 58, 110];

const FACE_OVERLAY_OPACITY = 0.2;

function isCortexMesh(m: { type?: string; opacity?: number }): boolean {
  return m.type !== "connectome" && (m.opacity ?? 1) >= 0.95;
}

export function BrainViewer({
  lhMeshUrl,
  rhMeshUrl,
  mesh,
  defaultSurface = "pial",
  stimulusAudioUrl,
  colormap = "redyell",
  vmin = 0,
  vmax = 1,
  fps = 1,
  height = 560,
  frame: externalFrame,
  onFrameChange,
  playing: externalPlaying,
  onPlayingChange,
  totalFrames: totalFramesProp,
}: BrainViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nvRef = useRef<NiivueInstance | null>(null);
  const activationLayerRef = useRef(0);

  const [internalFrame, setInternalFrame] = useState(0);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [totalFrames, setTotalFrames] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<SurfaceMode>(defaultSurface);
  const [showLabels, setShowLabels] = useState(false);
  const [showFace, setShowFace] = useState(true);
  const [ready, setReady] = useState(false);

  const frame = externalFrame ?? internalFrame;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const playing = externalPlaying ?? internalPlaying;
  const setFrame = onFrameChange ?? setInternalFrame;
  const setPlaying = onPlayingChange ?? setInternalPlaying;

  const hasRegionLabels = Boolean(
    mesh?.atlas?.region_labels?.lh && mesh?.atlas?.region_labels?.rh
  );
  const hasFaceOverlay = Boolean(
    mesh?.surfaces?.inflated?.lh && mesh?.surfaces?.inflated?.rh
  );

  const useLayered =
    Boolean(mesh?.activations?.lh && mesh?.surfaces?.[surface]?.lh);

  const geomLh = mesh?.surfaces?.[surface]?.lh ?? lhMeshUrl;
  const geomRh = mesh?.surfaces?.[surface]?.rh ?? rhMeshUrl;
  const actLh = mesh?.activations?.lh;
  const actRh = mesh?.activations?.rh;
  const faceLh = mesh?.surfaces?.inflated?.lh;
  const faceRh = mesh?.surfaces?.inflated?.rh;
  const labelLhUrl = mesh?.atlas?.region_labels?.lh;
  const labelRhUrl = mesh?.atlas?.region_labels?.rh;

  /** Inflated ghost sits behind pial/half; skip when already viewing inflated. */
  const showFaceOverlay = showFace && surface !== "inflated";

  const configureBoldLayer = useCallback(
    async (nv: NiivueInstance, meshId: string, layerIdx: number) => {
      const setLayer = nv.setMeshLayerProperty.bind(nv) as (
        id: string,
        layer: number,
        key: string,
        val: string | number | boolean
      ) => Promise<void>;
      await setLayer(meshId, layerIdx, "colormap", colormap);
      await setLayer(meshId, layerIdx, "cal_min", vmin);
      await setLayer(meshId, layerIdx, "cal_max", vmax);
      await setLayer(meshId, layerIdx, "opacity", 1);
      await setLayer(meshId, layerIdx, "isTransparentBelowCalMin", true);
      await setLayer(meshId, layerIdx, "frame4D", frameRef.current);
    },
    [colormap, vmin, vmax]
  );

  const configureEmbeddedScalars = useCallback(
    async (nv: NiivueInstance, meshId: string) => {
      const setLayer = nv.setMeshLayerProperty.bind(nv) as (
        id: string,
        layer: number,
        key: string,
        val: string | number | boolean
      ) => Promise<void>;
      const m = nv.meshes.find((x) => x.id === meshId);
      if (!m?.layers?.length) return;
      await setLayer(meshId, 0, "colormap", colormap);
      await setLayer(meshId, 0, "cal_min", vmin);
      await setLayer(meshId, 0, "cal_max", vmax);
      await setLayer(meshId, 0, "opacity", 1);
      await setLayer(meshId, 0, "isTransparentBelowCalMin", true);
      await setLayer(meshId, 0, "frame4D", frameRef.current);
      activationLayerRef.current = 0;
    },
    [colormap, vmin, vmax]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setReady(false);
        setError(null);

        const { Niivue } = await import("@niivue/niivue");
        if (cancelled || !canvasRef.current || !containerRef.current) return;

        nvRef.current = null;
        const nv = new Niivue({
          isResizeCanvas: true,
          backColor: [0.06, 0.07, 0.09, 1],
          show3Dcrosshair: false,
          isOrientCube: true,
        });
        await nv.attachToCanvas(canvasRef.current);
        nvRef.current = nv;

        const boldLayerLh = {
          url: actLh,
          colormap,
          cal_min: vmin,
          cal_max: vmax,
          opacity: 1,
          frame4D: frameRef.current,
        };
        const boldLayerRh = {
          url: actRh,
          colormap,
          cal_min: vmin,
          cal_max: vmax,
          opacity: 1,
          frame4D: frameRef.current,
        };

        const meshLoads = [];

        if (showFaceOverlay && faceLh && faceRh) {
          meshLoads.push(
            { url: faceLh, rgba255: FACE_OVERLAY_RGBA, opacity: FACE_OVERLAY_OPACITY },
            { url: faceRh, rgba255: FACE_OVERLAY_RGBA, opacity: FACE_OVERLAY_OPACITY }
          );
        }

        if (useLayered && actLh && actRh) {
          meshLoads.push(
            {
              url: geomLh,
              rgba255: BRAIN_RGBA,
              opacity: 1,
              layers: [boldLayerLh],
            },
            {
              url: geomRh,
              rgba255: BRAIN_RGBA,
              opacity: 1,
              layers: [boldLayerRh],
            }
          );
        } else {
          meshLoads.push(
            { url: geomLh, rgba255: BRAIN_RGBA, opacity: 1 },
            { url: geomRh, rgba255: BRAIN_RGBA, opacity: 1 }
          );
        }

        await nv.loadMeshes(
          meshLoads as unknown as Parameters<typeof nv.loadMeshes>[0]
        );
        activationLayerRef.current = 0;

        if (cancelled) return;

        for (const m of nv.meshes ?? []) {
          if (!isCortexMesh(m)) {
            nv.setMeshShader(m.id, "Matte");
            continue;
          }
          if (useLayered && actLh && actRh) {
            await configureBoldLayer(nv, m.id, activationLayerRef.current);
          } else {
            await configureEmbeddedScalars(nv, m.id);
          }
          nv.setMeshShader(m.id, "Matte");
        }

        if (showLabels && labelLhUrl && labelRhUrl) {
          try {
            const [lhLabels, rhLabels] = await Promise.all([
              loadRegionLabels(labelLhUrl),
              loadRegionLabels(labelRhUrl),
            ]);
            if (!cancelled) {
              addRegionLabelsToNiivue(nv, lhLabels, rhLabels, {
                textScale: 0.55,
                lineWidth: 1.6,
              });
            }
          } catch (labelErr) {
            console.warn("Region labels unavailable:", labelErr);
          }
        }

        if (cancelled) return;

        nv.scene.renderAzimuth = 180;
        nv.scene.renderElevation = 12;
        nv.resizeListener();
        nv.drawScene();

        const cortexMeshes = (nv.meshes ?? []).filter(isCortexMesh) as LoadedCortexMesh[];
        const layerIdx = activationLayerRef.current;
        const loaded = cortexMeshes[0];
        const n =
          totalFramesProp ??
          loaded?.layers?.[layerIdx]?.nFrame4D ??
          loaded?.layers?.[0]?.nFrame4D ??
          45;
        setTotalFrames(n || 45);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load Niivue");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [
    geomLh,
    geomRh,
    actLh,
    actRh,
    faceLh,
    faceRh,
    labelLhUrl,
    labelRhUrl,
    showLabels,
    showFaceOverlay,
    useLayered,
    colormap,
    vmin,
    vmax,
    configureBoldLayer,
    configureEmbeddedScalars,
    totalFramesProp,
  ]);

  useEffect(() => {
    if (!ready || !playing) return;

    const nv = nvRef.current;
    if (!nv) return;

    const cortexMeshes = (nv.meshes ?? []).filter(isCortexMesh);
    if (cortexMeshes.length === 0) return;

    const layerIdx = activationLayerRef.current;
    const n = totalFrames || 45;

    const interval = setInterval(() => {
      const next = (frameRef.current + 1) % n;
      for (const m of cortexMeshes) {
        void nv.setMeshLayerProperty(m.id, layerIdx, "frame4D", next);
      }
      nv.drawScene();
      onFrameChangeRef.current?.(next);
      if (!onFrameChangeRef.current) setInternalFrame(next);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [ready, playing, fps, totalFrames]);

  useEffect(() => {
    const nv = nvRef.current;
    if (!nv || !ready) return;

    const cortexMeshes = (nv.meshes ?? []).filter(isCortexMesh);
    if (cortexMeshes.length === 0) return;

    const layerIdx = activationLayerRef.current;
    for (const m of cortexMeshes) {
      void nv.setMeshLayerProperty(m.id, layerIdx, "frame4D", frame);
    }
    nv.drawScene();
  }, [frame, ready]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      nvRef.current?.resizeListener();
      nvRef.current?.drawScene();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (error) {
    return (
      <div className="card brain-viewer-card" style={{ minHeight: height }}>
        <p style={{ color: "#f0c080" }}>Brain viewer: {error}</p>
        <p style={{ fontSize: "0.85rem", color: "#9aa0a6" }}>
          Re-run <code>nerve export-web</code> to regenerate mesh bundles.
        </p>
      </div>
    );
  }

  return (
    <div className="card brain-viewer-card">
      <div className="brain-toolbar">
        <div className="brain-toolbar__group">
          <span className="brain-toolbar__title">Surface</span>
          {(["pial", "half", "inflated"] as SurfaceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`brain-toolbar__btn${surface === mode ? " is-active" : ""}`}
              onClick={() => setSurface(mode)}
              disabled={!mesh?.surfaces?.[mode]}
            >
              {SURFACE_LABELS[mode]}
            </button>
          ))}
        </div>
        {hasRegionLabels && (
          <div className="brain-toolbar__group">
            <span className="brain-toolbar__title">Labels</span>
            {(["off", "on"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`brain-toolbar__btn${(mode === "on") === showLabels ? " is-active" : ""}`}
                onClick={() => setShowLabels(mode === "on")}
              >
                {mode === "off" ? "Off" : "On"}
              </button>
            ))}
          </div>
        )}
        {hasFaceOverlay && surface !== "inflated" && (
          <div className="brain-toolbar__group">
            <span className="brain-toolbar__title">Face</span>
            {(["off", "on"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`brain-toolbar__btn${(mode === "on") === showFace ? " is-active" : ""}`}
                onClick={() => setShowFace(mode === "on")}
              >
                {mode === "off" ? "Off" : "On"}
              </button>
            ))}
          </div>
        )}
        <BrainColorbar colormap={colormap} vmin={vmin} vmax={vmax} />
      </div>

      <div ref={containerRef} className="brain-viewer-wrap" style={{ height }}>
        <canvas ref={canvasRef} className="brain-canvas" />
      </div>

      <StimulusAudio
        src={stimulusAudioUrl}
        frame={frame}
        total={totalFrames}
        playing={playing}
        fps={fps}
        onSeek={setFrame}
      />

      <Timeline
        frame={frame}
        total={totalFrames}
        playing={playing}
        onFrame={setFrame}
        onPlaying={setPlaying}
      />
    </div>
  );
}
