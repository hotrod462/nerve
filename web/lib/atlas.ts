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

export interface SpokeConnectomeOptions {
  spokeLength?: number;
  subsample?: number;
  edgeScale?: number;
}

/** Per-vertex normals from triangle mesh (for outward region spokes). */
export function computeVertexNormals(
  pts: ArrayLike<number>,
  tris: ArrayLike<number>
): Float32Array {
  const nVerts = pts.length / 3;
  const normals = new Float32Array(nVerts * 3);

  for (let i = 0; i < tris.length; i += 3) {
    const i0 = tris[i];
    const i1 = tris[i + 1];
    const i2 = tris[i + 2];

    const ax = pts[i0 * 3];
    const ay = pts[i0 * 3 + 1];
    const az = pts[i0 * 3 + 2];
    const bx = pts[i1 * 3];
    const by = pts[i1 * 3 + 1];
    const bz = pts[i1 * 3 + 2];
    const cx = pts[i2 * 3];
    const cy = pts[i2 * 3 + 1];
    const cz = pts[i2 * 3 + 2];

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    for (const vi of [i0, i1, i2]) {
      normals[vi * 3] += nx;
      normals[vi * 3 + 1] += ny;
      normals[vi * 3 + 2] += nz;
    }
  }

  for (let v = 0; v < nVerts; v++) {
    const base = v * 3;
    let nx = normals[base];
    let ny = normals[base + 1];
    let nz = normals[base + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[base] = nx / len;
    normals[base + 1] = ny / len;
    normals[base + 2] = nz / len;
  }

  return normals;
}

export function borderVerticesFromEdges(edges: number[][]): number[] {
  const verts = new Set<number>();
  for (const pair of edges) {
    if (pair.length < 2) continue;
    verts.add(pair[0]);
    verts.add(pair[1]);
  }
  return [...verts].sort((a, b) => a - b);
}

function addNode(
  nodes: NiivueConnectomeNode[],
  x: number,
  y: number,
  z: number
): number {
  const idx = nodes.length;
  nodes.push({ name: "", x, y, z, colorValue: 1, sizeValue: 0 });
  return idx;
}

/**
 * Outward dotted spokes from border vertices along surface normals.
 * Each spoke is two short segments with a gap (dotted appearance).
 */
export function buildSpokeConnectome(
  pts: ArrayLike<number>,
  tris: ArrayLike<number>,
  border: BorderEdgesData,
  name: string,
  options: SpokeConnectomeOptions = {}
): NiivueConnectomeJson {
  const spokeLength = options.spokeLength ?? 3.5;
  const subsample = Math.max(1, options.subsample ?? 1);
  const edgeScale = options.edgeScale ?? 0.22;

  const normals = computeVertexNormals(pts, tris);
  const borderVerts = borderVerticesFromEdges(border.edges);
  const nodes: NiivueConnectomeNode[] = [];
  const edges: NiivueConnectomeEdge[] = [];

  for (let i = 0; i < borderVerts.length; i += subsample) {
    const v = borderVerts[i];
    const base = v * 3;
    const px = pts[base];
    const py = pts[base + 1];
    const pz = pts[base + 2];
    const nx = normals[base];
    const ny = normals[base + 1];
    const nz = normals[base + 2];

    const dot0 = addNode(nodes, px, py, pz);
    const dot35 = addNode(
      nodes,
      px + nx * spokeLength * 0.35,
      py + ny * spokeLength * 0.35,
      pz + nz * spokeLength * 0.35
    );
    const dot55 = addNode(
      nodes,
      px + nx * spokeLength * 0.55,
      py + ny * spokeLength * 0.55,
      pz + nz * spokeLength * 0.55
    );
    const dot95 = addNode(
      nodes,
      px + nx * spokeLength * 0.95,
      py + ny * spokeLength * 0.95,
      pz + nz * spokeLength * 0.95
    );

    edges.push({ first: dot0, second: dot35, colorValue: 1 });
    edges.push({ first: dot55, second: dot95, colorValue: 1 });
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
    edgeScale,
    showLegend: false,
  };
}
