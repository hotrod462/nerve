import type { VertexYeoData } from "@/lib/brainMapProcessor";

export interface NiivueLabelLut {
  R: number[];
  G: number[];
  B: number[];
  A?: number[];
  I?: number[];
  labels?: string[];
}

export interface AtlasData {
  atlas: string;
  n_parcels: number;
  yeo_networks: number;
  yeo_lut: NiivueLabelLut;
  parcel_lut: NiivueLabelLut;
  yeo_order: string[];
}

export interface RegionLabelEntry {
  id: number;
  name: string;
  anchor: [number, number, number];
  label: [number, number, number];
}

export interface RegionLabelsData {
  n_regions: number;
  regions: RegionLabelEntry[];
}

export interface AtlasBorderUrls {
  yeo?: { lh: string; rh: string };
  parcels?: { lh: string; rh: string };
}

export interface MeshAtlasUrls {
  parcels?: { lh: string; rh: string };
  yeo?: { lh: string; rh: string };
  lut?: string;
  borders?: AtlasBorderUrls;
  region_labels?: { lh: string; rh: string };
}

export interface MetaLabelStyle {
  textScale?: number;
  lineWidth?: number;
}

type NiivueLabelStyle = {
  textColor: number[];
  textScale: number;
  textAlignment: string;
  lineWidth: number;
  lineColor: number[];
  lineTerminator: string;
  bulletScale: number;
  backgroundColor?: number[];
};

/** Meta-style white label pill + leader line from cortex anchor. */
export function metaLabelStyle(options: MetaLabelStyle = {}): NiivueLabelStyle {
  return {
    textColor: [1, 1, 1, 1],
    backgroundColor: [0.04, 0.04, 0.05, 0.9],
    lineWidth: options.lineWidth ?? 1.4,
    lineColor: [1, 1, 1, 0.88],
    textScale: options.textScale ?? 0.38,
    textAlignment: "left",
    lineTerminator: "none",
    bulletScale: 0,
  };
}

export async function loadRegionLabels(url: string): Promise<RegionLabelsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load region labels: ${url}`);
  return res.json() as Promise<RegionLabelsData>;
}

export async function loadAtlasDocument(url: string): Promise<AtlasData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load atlas: ${url}`);
  return res.json() as Promise<AtlasData>;
}

export async function loadVertexYeo(url: string): Promise<VertexYeoData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load vertex Yeo map: ${url}`);
  return res.json() as Promise<VertexYeoData>;
}

type LabelNiivue = Pick<
  InstanceType<typeof import("@niivue/niivue").Niivue>,
  "addLabel"
>;

export function addRegionLabelsToNiivue(
  nv: LabelNiivue,
  lh: RegionLabelsData,
  rh: RegionLabelsData,
  options: MetaLabelStyle = {}
): void {
  const style = metaLabelStyle(options);
  for (const region of [...lh.regions, ...rh.regions]) {
    nv.addLabel(
      region.name,
      style as Parameters<LabelNiivue["addLabel"]>[1],
      [region.anchor, region.label]
    );
  }
}
