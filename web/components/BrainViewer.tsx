"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBorderConnectome,
  segmentLutFromLabelLut,
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
}

type NiivueInstance = InstanceType<typeof import("@niivue/niivue").Niivue>;

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

const SEGMENT_LAYER_OPACITY = 0.44;

export function BrainViewer({
  lhMeshUrl,
  rhMeshUrl,
  mesh,
  defaultSurface = "half",
  stimulusAudioUrl,
  colormap = "hot",
  vmin = 0,
  vmax = 1,
  fps = 1,
  height = 560,
  frame: externalFrame,
  onFrameChange,
  playing: externalPlaying,
  onPlayingChange,
}: BrainViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nvRef = useRef<NiivueInstance | null>(null);
  const activationLayerRef = useRef(0);
  const segmentLayerRef = useRef<number | null>(null);

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

  const hasAtlas = Boolean(mesh?.atlas?.yeo?.lh && mesh?.atlas?.lut);

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
  const sulcLh = mesh?.sulc?.lh;
  const sulcRh = mesh?.sulc?.rh;
  const sulcMin = mesh?.sulcRange?.min ?? -12;
  const sulcMax = mesh?.sulcRange?.max ?? 12;

  const showRegions = regions !== "off";
  const segmentLh =
    regions === "yeo"
      ? mesh?.atlas?.yeo?.lh
      : regions === "parcels"
        ? mesh?.atlas?.parcels?.lh
        : undefined;
  const segmentRh =
    regions === "yeo"
      ? mesh?.atlas?.yeo?.rh
      : regions === "parcels"
        ? mesh?.atlas?.parcels?.rh
        : undefined;

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

  const segmentLut = useMemo(() => {
    if (!showRegions || !regionLut) return undefined;
    return segmentLutFromLabelLut(regionLut);
  }, [showRegions, regionLut]);

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
      await setLayer(meshId, layerIdx, "isTransparentBelowCalMin", false);
      await setLayer(meshId, layerIdx, "frame4D", frameRef.current);
    },
    [colormap, vmin, vmax]
  );

  const configureSegmentLayer = useCallback(
    async (
      nv: NiivueInstance,
      meshId: string,
      layerIdx: number,
      lut: NiivueLabelLut
    ) => {
      const setLayer = nv.setMeshLayerProperty.bind(nv) as (
        id: string,
        layer: number,
        key: string,
        val: string | number | boolean | NiivueLabelLut
      ) => Promise<void>;
      await setLayer(meshId, layerIdx, "colormapLabel", lut);
      await setLayer(meshId, layerIdx, "opacity", SEGMENT_LAYER_OPACITY);
      await setLayer(meshId, layerIdx, "outlineBorder", 0);
      await setLayer(meshId, layerIdx, "showLegend", false);
      await setLayer(meshId, layerIdx, "frame4D", 0);
    },
    []
  );

  const configureSulcLayer = useCallback(
    async (nv: NiivueInstance, meshId: string) => {
      const setLayer = nv.setMeshLayerProperty.bind(nv) as (
        id: string,
        layer: number,
        key: string,
        val: string | number | boolean
      ) => Promise<void>;
      await setLayer(meshId, 0, "colormap", "gray");
      await setLayer(meshId, 0, "cal_min", sulcMin);
      await setLayer(meshId, 0, "cal_max", sulcMax);
      await setLayer(meshId, 0, "opacity", 1);
      await setLayer(meshId, 0, "isTransparentBelowCalMin", false);
    },
    [sulcMin, sulcMax]
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
      await setLayer(meshId, 0, "isTransparentBelowCalMin", false);
      await setLayer(meshId, 0, "frame4D", frameRef.current);
      activationLayerRef.current = 0;
      segmentLayerRef.current = null;
    },
    [colormap, vmin, vmax]
  );

  const addBorderConnectomes = useCallback(
    async (
      nv: NiivueInstance,
      lhUrl: string,
      rhUrl: string,
      cortexMeshes: Array<{ id: string; pts: Float32Array | number[]; type?: string }>
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

      if (cortexMeshes[0]?.pts) {
        const lhConn = nv.loadConnectomeAsMesh(
          buildBorderConnectome(cortexMeshes[0].pts, lhBorder, "lh_region_borders") as unknown as Parameters<
            typeof nv.loadConnectomeAsMesh
          >[0]
        );
        nv.addMesh(lhConn);
      }
      if (cortexMeshes[1]?.pts) {
        const rhConn = nv.loadConnectomeAsMesh(
          buildBorderConnectome(cortexMeshes[1].pts, rhBorder, "rh_region_borders") as unknown as Parameters<
            typeof nv.loadConnectomeAsMesh
          >[0]
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
        if (showRegions && !segmentLut) return;

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
          const sulcLayersLh = sulcLh
            ? [{ url: sulcLh, colormap: "gray", cal_min: sulcMin, cal_max: sulcMax, opacity: 1 }]
            : [];
          const sulcLayersRh = sulcRh
            ? [{ url: sulcRh, colormap: "gray", cal_min: sulcMin, cal_max: sulcMax, opacity: 1 }]
            : [];

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

          const segmentLayersLh =
            showRegions && segmentLh && segmentLut
              ? [{ url: segmentLh, colormapLabel: segmentLut, opacity: SEGMENT_LAYER_OPACITY, frame4D: 0 }]
              : [];
          const segmentLayersRh =
            showRegions && segmentRh && segmentLut
              ? [{ url: segmentRh, colormapLabel: segmentLut, opacity: SEGMENT_LAYER_OPACITY, frame4D: 0 }]
              : [];

          await nv.loadMeshes([
            {
              url: geomLh,
              rgba255: [140, 140, 140, 255],
              opacity: 1,
              layers: [...sulcLayersLh, boldLayerLh, ...segmentLayersLh],
            },
            {
              url: geomRh,
              rgba255: [140, 140, 140, 255],
              opacity: 1,
              layers: [...sulcLayersRh, boldLayerRh, ...segmentLayersRh],
            },
          ] as unknown as Parameters<typeof nv.loadMeshes>[0]);

          activationLayerRef.current = sulcLh ? 1 : 0;
          segmentLayerRef.current = showRegions
            ? activationLayerRef.current + 1
            : null;

          if (cancelled) return;

          const cortexMeshes = (nv.meshes ?? []).filter(
            (m) => (m as { type?: string }).type !== "connectome"
          );

          for (const m of cortexMeshes) {
            if (sulcLh) await configureSulcLayer(nv, m.id);
            await configureBoldLayer(nv, m.id, activationLayerRef.current);
            if (showRegions && segmentLut && segmentLayerRef.current !== null) {
              await configureSegmentLayer(nv, m.id, segmentLayerRef.current, segmentLut);
            }
            nv.setMeshShader(m.id, "Phong");
          }

          if (
            showRegions &&
            borderLhUrl &&
            borderRhUrl &&
            cortexMeshes.length >= 2
          ) {
            try {
              await addBorderConnectomes(nv, borderLhUrl, borderRhUrl, cortexMeshes);
            } catch (borderErr) {
              console.warn("Region border geometry unavailable:", borderErr);
            }
          }
        } else {
          await nv.loadMeshes([
            { url: geomLh, rgba255: [140, 140, 140, 255], opacity: 1 },
            { url: geomRh, rgba255: [140, 140, 140, 255], opacity: 1 },
          ] as unknown as Parameters<typeof nv.loadMeshes>[0]);

          if (cancelled) return;
          for (const m of nv.meshes ?? []) {
            await configureEmbeddedScalars(nv, m.id);
            nv.setMeshShader(m.id, "Phong");
          }
        }

        if (cancelled) return;

        nv.scene.renderAzimuth = 180;
        nv.scene.renderElevation = 12;
        nv.resizeListener();
        nv.drawScene();

        const cortexMeshes = (nv.meshes ?? []).filter(
          (m) => (m as { type?: string }).type !== "connectome"
        );
        const layerIdx = activationLayerRef.current;
        const n =
          cortexMeshes[0]?.layers?.[layerIdx]?.nFrame4D ??
          cortexMeshes[0]?.layers?.[0]?.nFrame4D ??
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
    segmentLh,
    segmentRh,
    borderLhUrl,
    borderRhUrl,
    regions,
    showRegions,
    segmentLut,
    sulcLh,
    sulcRh,
    useLayered,
    colormap,
    vmin,
    vmax,
    configureBoldLayer,
    configureSegmentLayer,
    configureEmbeddedScalars,
    configureSulcLayer,
    addBorderConnectomes,
    sulcMin,
    sulcMax,
  ]);

  useEffect(() => {
    if (!ready || !playing) return;

    const nv = nvRef.current;
    if (!nv) return;

    const cortexMeshes = (nv.meshes ?? []).filter(
      (m) => (m as { type?: string }).type !== "connectome"
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
      (m) => (m as { type?: string }).type !== "connectome"
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
          Re-run <code>nerve export-web</code> to regenerate mesh bundles with atlas segments.
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
                disabled={mode !== "off" && !atlasData}
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
