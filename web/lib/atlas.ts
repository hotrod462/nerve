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

export interface BorderEdgesData {
  n_vertices: number;
  n_edges: number;
  edges: number[][];
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
}

export interface NiivueConnectomeNode {
  name: string;
  x: number;
  y: number;
  z: number;
  colorValue: number;
  sizeValue: number;
}

export interface NiivueConnectomeEdge {
  first: number;
  second: number;
  colorValue: number;
}

export interface NiivueConnectomeJson {
  name: string;
  nodes: NiivueConnectomeNode[];
  edges: NiivueConnectomeEdge[];
  nodeColormap: string;
  edgeColormap: string;
  nodeMinColor: number;
  nodeMaxColor: number;
  edgeMin: number;
  edgeMax: number;
  nodeScale: number;
  edgeScale: number;
  showLegend: boolean;
}

/** Semi-transparent region fill for 3D segment patches over BOLD. */
export function segmentLutFromLabelLut(
  lut: NiivueLabelLut,
  fillAlpha = 105
): NiivueLabelLut {
  const n = lut.R.length;
  const indices = lut.I ?? lut.R.map((_, i) => i);
  const A = indices.map((idx) => (idx <= 0 ? 0 : fillAlpha));
  return {
    R: [...lut.R],
    G: [...lut.G],
    B: [...lut.B],
    A,
    I: lut.I ? [...lut.I] : undefined,
    labels: lut.labels ? [...lut.labels] : undefined,
  };
}

/** Build Niivue connectome JSON for 3D border line geometry on a loaded mesh. */
export function buildBorderConnectome(
  pts: ArrayLike<number>,
  border: BorderEdgesData,
  name: string
): NiivueConnectomeJson {
  const nodeForVertex = new Map<number, number>();
  const nodes: NiivueConnectomeNode[] = [];
  const edges: NiivueConnectomeEdge[] = [];

  const nodeIndex = (v: number) => {
    let idx = nodeForVertex.get(v);
    if (idx === undefined) {
      const base = v * 3;
      idx = nodes.length;
      nodeForVertex.set(v, idx);
      nodes.push({
        name: "",
        x: pts[base],
        y: pts[base + 1],
        z: pts[base + 2],
        colorValue: 1,
        sizeValue: 0,
      });
    }
    return idx;
  };

  for (const pair of border.edges) {
    if (pair.length < 2) continue;
    edges.push({
      first: nodeIndex(pair[0]),
      second: nodeIndex(pair[1]),
      colorValue: 1,
    });
  }

  return {
    name,
    nodes,
    edges,
    nodeColormap: "gray",
    edgeColormap: "gray",
    nodeMinColor: 0,
    nodeMaxColor: 1,
    edgeMin: 0,
    edgeMax: 2,
    nodeScale: 0,
    edgeScale: 0.45,
    showLegend: false,
  };
}
