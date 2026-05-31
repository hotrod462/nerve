"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addRegionLabelsToNiivue,
  loadAtlasDocument,
  loadRegionLabels,
  loadVertexYeo,
  type AtlasData,
  type MeshAtlasUrls,
} from "@/lib/atlas";
import {
  buildDisplayValues,
  computeMapRange,
  type BrainMapMode,
} from "@/lib/brainMapProcessor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BrainColorbar } from "./BrainColorbar";
import { Timeline } from "./Timeline";

export type SurfaceMode = "pial" | "half" | "inflated";

export interface MeshBundle {
  surfaces?: Record<SurfaceMode, { lh: string; rh: string }>;
  activations?: { lh: string; rh: string };
  sulc?: { lh: string; rh: string };
  sulcRange?: { min: number; max: number };
  atlas?: MeshAtlasUrls;
}

export interface BrainAnalysisUrls {
  vertexYeo?: string;
  atlasLut?: string;
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
  /** Per-TR dominant Yeo network keys — enables network-focus map mode. */
  dominantNetworkTr?: string[];
  analysisUrls?: BrainAnalysisUrls;
  /** Parent owns playhead advancement (e.g. StimulusPlayback). */
  externalPlayback?: boolean;
  /** Hide transport controls when rendered elsewhere. */
  showTimeline?: boolean;
}

type NiivueInstance = InstanceType<typeof import("@niivue/niivue").Niivue>;

type LoadedCortexMesh = {
  id: string;
  type?: string;
  layers?: Array<{ nFrame4D?: number; values?: ArrayLike<number> | Float32Array }>;
  updateMesh?: (gl: WebGL2RenderingContext) => void;
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
const YEO_OVERLAY_OPACITY = 0.42;

const MAP_MODE_LABELS: Record<BrainMapMode, string> = {
  absolute: "Absolute",
  residual: "Residual",
  network: "Network",
};

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
  dominantNetworkTr,
  analysisUrls,
  externalPlayback = false,
  showTimeline = true,
}: BrainViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nvRef = useRef<NiivueInstance | null>(null);
  const activationLayerRef = useRef(0);
  const yeoLayerRef = useRef(1);
  const sourceLhRef = useRef<Float32Array | null>(null);
  const sourceRhRef = useRef<Float32Array | null>(null);
  const yeoLhRef = useRef<number[] | null>(null);
  const yeoRhRef = useRef<number[] | null>(null);
  const yeoOrderRef = useRef<string[]>([]);
  const nFramesRef = useRef(45);
  const mapModeRef = useRef<BrainMapMode>("absolute");
  const showYeoOverlayRef = useRef(false);

  const [internalFrame, setInternalFrame] = useState(0);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [totalFrames, setTotalFrames] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<SurfaceMode>(defaultSurface);
  const [showLabels, setShowLabels] = useState(false);
  const [showFace, setShowFace] = useState(true);
  const [showYeoOverlay, setShowYeoOverlay] = useState(false);
  const [mapMode, setMapMode] = useState<BrainMapMode>("absolute");
  const [ready, setReady] = useState(false);

  mapModeRef.current = mapMode;
  showYeoOverlayRef.current = showYeoOverlay;

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
  const hasYeoOverlay = Boolean(mesh?.atlas?.yeo?.lh && mesh?.atlas?.yeo?.rh);
  const hasNetworkMode = Boolean(
    analysisUrls?.vertexYeo && dominantNetworkTr?.length
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
  const yeoLhUrl = mesh?.atlas?.yeo?.lh;
  const yeoRhUrl = mesh?.atlas?.yeo?.rh;
  const analysisVertexYeoUrl = analysisUrls?.vertexYeo;
  const analysisAtlasLutUrl = analysisUrls?.atlasLut;

  /** Inflated ghost sits behind pial/half; skip when already viewing inflated. */
  const showFaceOverlay = showFace && surface !== "inflated";

  const applyMapModeToCortex = useCallback(
    (mode: BrainMapMode) => {
      const nv = nvRef.current;
      if (!nv?.gl || !sourceLhRef.current || !sourceRhRef.current) return;

      const cortexMeshes = (nv.meshes ?? []).filter(isCortexMesh);
      if (cortexMeshes.length < 2) return;

      const nFrames = nFramesRef.current;
      const layerIdx = activationLayerRef.current;
      const dominant = dominantNetworkTr ?? null;
      const yeoOrder = yeoOrderRef.current;

      const configs = [
        { mesh: cortexMeshes[0], source: sourceLhRef.current, yeo: yeoLhRef.current },
        { mesh: cortexMeshes[1], source: sourceRhRef.current, yeo: yeoRhRef.current },
      ];

      for (const { mesh: cortexMesh, source, yeo } of configs) {
        if (!source || !cortexMesh.layers?.[layerIdx]) continue;
        const nVerts = Math.floor(source.length / nFrames);
        const display = buildDisplayValues(
          source,
          nVerts,
          nFrames,
          mode,
          yeo,
          dominant,
          yeoOrder
        );
        const layer = cortexMesh.layers[layerIdx];
        layer.values = display;

        if (mode === "absolute") {
          layer.cal_min = vmin;
          layer.cal_max = vmax;
        } else {
          const range = computeMapRange(display);
          layer.cal_min = range.min;
          layer.cal_max = range.max;
        }

        const meshObj = nv.meshes.find((m) => m.id === cortexMesh.id) as
          | { updateMesh?: (gl: WebGL2RenderingContext) => void }
          | undefined;
        meshObj?.updateMesh?.(nv.gl);
      }

      nv.drawScene();
    },
    [dominantNetworkTr, vmin, vmax]
  );

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

        let atlasDoc: AtlasData | null = null;
        if (analysisUrls?.atlasLut) {
          try {
            atlasDoc = await loadAtlasDocument(analysisUrls.atlasLut);
            yeoOrderRef.current = atlasDoc.yeo_order;
          } catch (e) {
            console.warn("Atlas LUT unavailable:", e);
          }
        }

        if (analysisUrls?.vertexYeo) {
          try {
            const vertexYeo = await loadVertexYeo(analysisUrls.vertexYeo);
            yeoLhRef.current = vertexYeo.lh;
            yeoRhRef.current = vertexYeo.rh;
            if (vertexYeo.yeo_order.length) {
              yeoOrderRef.current = vertexYeo.yeo_order;
            }
          } catch (e) {
            console.warn("Vertex Yeo map unavailable:", e);
          }
        }

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

        const yeoLayerLh =
          hasYeoOverlay && yeoLhUrl && atlasDoc
            ? {
                url: yeoLhUrl,
                colormap: "gray",
                colormapLabel: atlasDoc.yeo_lut,
                opacity: showYeoOverlayRef.current ? YEO_OVERLAY_OPACITY : 0,
                cal_min: 0,
                cal_max: 7,
              }
            : null;
        const yeoLayerRh =
          hasYeoOverlay && yeoRhUrl && atlasDoc
            ? {
                url: yeoRhUrl,
                colormap: "gray",
                colormapLabel: atlasDoc.yeo_lut,
                opacity: showYeoOverlayRef.current ? YEO_OVERLAY_OPACITY : 0,
                cal_min: 0,
                cal_max: 7,
              }
            : null;

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
              layers: yeoLayerLh
                ? [boldLayerLh, yeoLayerLh]
                : [boldLayerLh],
            },
            {
              url: geomRh,
              rgba255: BRAIN_RGBA,
              opacity: 1,
              layers: yeoLayerRh
                ? [boldLayerRh, yeoLayerRh]
                : [boldLayerRh],
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

        const cortexMeshesLoaded = (nv.meshes ?? []).filter(isCortexMesh) as LoadedCortexMesh[];
        for (const m of cortexMeshesLoaded) {
          const layer = m.layers?.[activationLayerRef.current];
          if (layer?.values) {
            const values = layer.values;
            const copy =
              values instanceof Float32Array
                ? new Float32Array(values)
                : new Float32Array(Array.from(values as ArrayLike<number>));
            if (m.id === cortexMeshesLoaded[0]?.id) {
              sourceLhRef.current = copy;
            } else if (m.id === cortexMeshesLoaded[1]?.id) {
              sourceRhRef.current = copy;
            }
          }
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
        nFramesRef.current = n || 45;
        setTotalFrames(n || 45);
        applyMapModeToCortex(mapModeRef.current);
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
    analysisVertexYeoUrl,
    analysisAtlasLutUrl,
    hasYeoOverlay,
    yeoLhUrl,
    yeoRhUrl,
  ]);

  useEffect(() => {
    applyMapModeToCortex(mapMode);
  }, [mapMode, applyMapModeToCortex, dominantNetworkTr]);

  useEffect(() => {
    const nv = nvRef.current;
    if (!nv?.gl || !ready || !hasYeoOverlay) return;

    const cortexMeshes = (nv.meshes ?? []).filter(isCortexMesh);
    const yeoIdx = yeoLayerRef.current;
    const opacity = showYeoOverlay ? YEO_OVERLAY_OPACITY : 0;

    for (const m of cortexMeshes) {
      if (m.layers?.[yeoIdx]) {
        void nv.setMeshLayerProperty(m.id, yeoIdx, "opacity", opacity);
      }
    }
    nv.drawScene();
  }, [showYeoOverlay, ready, hasYeoOverlay]);

  useEffect(() => {
    if (!ready || !playing || externalPlayback) return;

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
  }, [ready, playing, fps, totalFrames, externalPlayback]);

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
      <Card style={{ minHeight: height }}>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Brain viewer error</AlertTitle>
            <AlertDescription>
              {error}. Re-run <code>nerve export-web</code> to regenerate mesh
              bundles.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardContent className="space-y-3 pt-0">
        <div className="brain-toolbar">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Surface
              </span>
              <ToggleGroup
                value={[surface]}
                onValueChange={(values) => {
                  const next = values[0] as SurfaceMode | undefined;
                  if (next) setSurface(next);
                }}
                variant="outline"
                size="sm"
              >
                {(["pial", "half", "inflated"] as SurfaceMode[]).map((mode) => (
                  <ToggleGroupItem
                    key={mode}
                    value={mode}
                    disabled={!mesh?.surfaces?.[mode]}
                  >
                    {SURFACE_LABELS[mode]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            {hasRegionLabels && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Labels
                </span>
                <ToggleGroup
                  value={[showLabels ? "on" : "off"]}
                  onValueChange={(values) => setShowLabels(values[0] === "on")}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="off">Off</ToggleGroupItem>
                  <ToggleGroupItem value="on">On</ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
            {hasFaceOverlay && surface !== "inflated" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Face
                </span>
                <ToggleGroup
                  value={[showFace ? "on" : "off"]}
                  onValueChange={(values) => setShowFace(values[0] === "on")}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="off">Off</ToggleGroupItem>
                  <ToggleGroupItem value="on">On</ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
            {hasYeoOverlay && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Yeo
                </span>
                <ToggleGroup
                  value={[showYeoOverlay ? "on" : "off"]}
                  onValueChange={(values) =>
                    setShowYeoOverlay(values[0] === "on")
                  }
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="off">Off</ToggleGroupItem>
                  <ToggleGroupItem value="on">On</ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
            {useLayered && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Map
                </span>
                <ToggleGroup
                  value={[mapMode]}
                  onValueChange={(values) => {
                    const next = values[0] as BrainMapMode | undefined;
                    if (next) setMapMode(next);
                  }}
                  variant="outline"
                  size="sm"
                >
                  {(Object.keys(MAP_MODE_LABELS) as BrainMapMode[]).map(
                    (mode) => (
                      <ToggleGroupItem
                        key={mode}
                        value={mode}
                        disabled={mode === "network" && !hasNetworkMode}
                        title={
                          mode === "network" && !hasNetworkMode
                            ? "Re-run export-web for vertex Yeo map"
                            : undefined
                        }
                      >
                        {MAP_MODE_LABELS[mode]}
                      </ToggleGroupItem>
                    )
                  )}
                </ToggleGroup>
              </div>
            )}
          </div>
          <BrainColorbar colormap={colormap} vmin={vmin} vmax={vmax} />
        </div>

        <div ref={containerRef} className="brain-viewer-wrap" style={{ height }}>
          <canvas ref={canvasRef} className="brain-canvas" />
        </div>

        {showTimeline ? (
          <Timeline
            frame={frame}
            total={totalFrames}
            playing={playing}
            onFrame={setFrame}
            onPlaying={setPlaying}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
