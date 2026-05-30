"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildSpokeConnectome,
  type AtlasData,
  type BorderEdgesData,
  type MeshAtlasUrls,
  type NiivueLabelLut,
} from "@/lib/atlas";
import { BrainColorbar } from "./BrainColorbar";
import { BrainRegionLegend } from "./BrainRegionLegend";
import { StimulusAudio } from "./StimulusAudio";
import { Timeline } from "./Timeline";

export type SurfaceMode = "pial" | "half" | "inflated";
export type RegionMode = "off" | "yeo" | "parcels";

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

type CortexMesh = {
  id: string;
  pts: Float32Array | number[];
  tris: Uint32Array | number[];
  type?: string;
};

type LoadedCortexMesh = CortexMesh & {
  layers?: Array<{ nFrame4D?: number }>;
};

const SURFACE_LABELS: Record<SurfaceMode, string> = {
  pial: "Normal",
  half: "Smooth",
  inflated: "Inflated",
};

const REGION_LABELS: Record<RegionMode, string> = {
  off: "Off",
  yeo: "Yeo",
  parcels: "Parcels",
};

/** Meta-style white brain base color. */
const BRAIN_RGBA: [number, number, number, number] = [248, 248, 248, 255];

const SPOKE_SUBSAMPLE: Record<RegionMode, number> = {
  off: 1,
  yeo: 3,
  parcels: 10,
};

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
  const [internalPlaying, setInternalPlaying] = useState(true);
  const [totalFrames, setTotalFrames] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<SurfaceMode>(defaultSurface);
  const [regions, setRegions] = useState<RegionMode>("off");
  const [atlasData, setAtlasData] = useState<AtlasData | null>(null);
  const [ready, setReady] = useState(false);

  const frame = externalFrame ?? internalFrame;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const playing = externalPlaying ?? internalPlaying;
  const setFrame = onFrameChange ?? setInternalFrame;
  const setPlaying = onPlayingChange ?? setInternalPlaying;

  const hasAtlas = Boolean(mesh?.atlas?.borders?.yeo?.lh && mesh?.atlas?.lut);

  useEffect(() => {
    const lutUrl = mesh?.atlas?.lut;
    if (!lutUrl) {
      setAtlasData(null);
      return;
    }
    let cancelled = false;
    fetch(lutUrl)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load atlas");
        return r.json() as Promise<AtlasData>;
      })
      .then((data) => {
        if (!cancelled) setAtlasData(data);
      })
      .catch(() => {
        if (!cancelled) setAtlasData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mesh?.atlas?.lut]);

  const useLayered =
    Boolean(mesh?.activations?.lh && mesh?.surfaces?.[surface]?.lh);

  const geomLh = mesh?.surfaces?.[surface]?.lh ?? lhMeshUrl;
  const geomRh = mesh?.surfaces?.[surface]?.rh ?? rhMeshUrl;
  const actLh = mesh?.activations?.lh;
  const actRh = mesh?.activations?.rh;

  const showRegions = regions !== "off";
  const borderLhUrl =
    regions === "yeo"
      ? mesh?.atlas?.borders?.yeo?.lh
      : regions === "parcels"
        ? mesh?.atlas?.borders?.parcels?.lh
        : undefined;
  const borderRhUrl =
    regions === "yeo"
      ? mesh?.atlas?.borders?.yeo?.rh
      : regions === "parcels"
        ? mesh?.atlas?.borders?.parcels?.rh
        : undefined;

  const regionLut: NiivueLabelLut | undefined =
    regions === "yeo"
      ? atlasData?.yeo_lut
      : regions === "parcels"
        ? atlasData?.parcel_lut
        : undefined;

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

  const addSpokeConnectomes = useCallback(
    async (
      nv: NiivueInstance,
      lhUrl: string,
      rhUrl: string,
      cortexMeshes: CortexMesh[],
      mode: RegionMode
    ) => {
      const loadBorder = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load border edges: ${url}`);
        return res.json() as Promise<BorderEdgesData>;
      };

      const [lhBorder, rhBorder] = await Promise.all([
        loadBorder(lhUrl),
        loadBorder(rhUrl),
      ]);

      const subsample = SPOKE_SUBSAMPLE[mode];

      if (cortexMeshes[0]?.pts && cortexMeshes[0]?.tris) {
        const lhConn = nv.loadConnectomeAsMesh(
          buildSpokeConnectome(
            cortexMeshes[0].pts,
            cortexMeshes[0].tris,
            lhBorder,
            "lh_region_spokes",
            { subsample }
          ) as unknown as Parameters<typeof nv.loadConnectomeAsMesh>[0]
        );
        nv.addMesh(lhConn);
      }
      if (cortexMeshes[1]?.pts && cortexMeshes[1]?.tris) {
        const rhConn = nv.loadConnectomeAsMesh(
          buildSpokeConnectome(
            cortexMeshes[1].pts,
            cortexMeshes[1].tris,
            rhBorder,
            "rh_region_spokes",
            { subsample }
          ) as unknown as Parameters<typeof nv.loadConnectomeAsMesh>[0]
        );
        nv.addMesh(rhConn);
      }
    },
    []
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

        if (useLayered && actLh && actRh) {
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

          await nv.loadMeshes([
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
            },
          ] as unknown as Parameters<typeof nv.loadMeshes>[0]);

          activationLayerRef.current = 0;

          if (cancelled) return;

          const cortexMeshes = (nv.meshes ?? []).filter(
            (m) => (m as CortexMesh).type !== "connectome"
          ) as CortexMesh[];

          for (const m of cortexMeshes) {
            await configureBoldLayer(nv, m.id, activationLayerRef.current);
            nv.setMeshShader(m.id, "Matte");
          }

          if (
            showRegions &&
            borderLhUrl &&
            borderRhUrl &&
            cortexMeshes.length >= 2
          ) {
            try {
              await addSpokeConnectomes(
                nv,
                borderLhUrl,
                borderRhUrl,
                cortexMeshes,
                regions
              );
            } catch (spokeErr) {
              console.warn("Region spoke geometry unavailable:", spokeErr);
            }
          }
        } else {
          await nv.loadMeshes([
            { url: geomLh, rgba255: BRAIN_RGBA, opacity: 1 },
            { url: geomRh, rgba255: BRAIN_RGBA, opacity: 1 },
          ] as unknown as Parameters<typeof nv.loadMeshes>[0]);

          if (cancelled) return;
          for (const m of nv.meshes ?? []) {
            await configureEmbeddedScalars(nv, m.id);
            nv.setMeshShader(m.id, "Matte");
          }
        }

        if (cancelled) return;

        nv.scene.renderAzimuth = 180;
        nv.scene.renderElevation = 12;
        nv.resizeListener();
        nv.drawScene();

        const cortexMeshes = (nv.meshes ?? []).filter(
          (m) => (m as CortexMesh).type !== "connectome"
        ) as CortexMesh[];
        const layerIdx = activationLayerRef.current;
        const loaded = cortexMeshes[0] as LoadedCortexMesh | undefined;
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
    borderLhUrl,
    borderRhUrl,
    regions,
    showRegions,
    useLayered,
    colormap,
    vmin,
    vmax,
    configureBoldLayer,
    configureEmbeddedScalars,
    addSpokeConnectomes,
    totalFramesProp,
  ]);

  useEffect(() => {
    if (!ready || !playing) return;

    const nv = nvRef.current;
    if (!nv) return;

    const cortexMeshes = (nv.meshes ?? []).filter(
      (m) => (m as CortexMesh).type !== "connectome"
    );
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

    const cortexMeshes = (nv.meshes ?? []).filter(
      (m) => (m as CortexMesh).type !== "connectome"
    );
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
        {hasAtlas && (
          <div className="brain-toolbar__group">
            <span className="brain-toolbar__title">Regions</span>
            {(["off", "yeo", "parcels"] as RegionMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`brain-toolbar__btn${regions === mode ? " is-active" : ""}`}
                onClick={() => setRegions(mode)}
                disabled={mode !== "off" && !mesh?.atlas?.borders}
              >
                {REGION_LABELS[mode]}
              </button>
            ))}
          </div>
        )}
        <BrainColorbar colormap={colormap} vmin={vmin} vmax={vmax} />
        {showRegions && regionLut ? (
          <BrainRegionLegend
            lut={regionLut}
            title={`${REGION_LABELS[regions]} regions`}
            compact={regions === "parcels"}
          />
        ) : null}
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
