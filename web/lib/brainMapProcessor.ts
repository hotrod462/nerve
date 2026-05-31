/** Client-side activation map transforms for BrainViewer modes. */

export type BrainMapMode = "absolute" | "residual" | "network";

export interface VertexYeoData {
  yeo_order: string[];
  lh: number[];
  rh: number[];
}

const YEO_KEY_TO_ID = (order: string[]) =>
  Object.fromEntries(order.map((net, i) => [net, i + 1]));

export function computeMapRange(values: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    return { min: min - 0.5, max: max + 0.5 };
  }
  return { min, max };
}

export function buildDisplayValues(
  source: Float32Array,
  nVerts: number,
  nFrames: number,
  mode: BrainMapMode,
  yeoIds: number[] | null,
  dominantNetworkTr: string[] | null,
  yeoOrder: string[]
): Float32Array {
  const out = new Float32Array(source.length);
  const keyToId = YEO_KEY_TO_ID(yeoOrder);

  for (let t = 0; t < nFrames; t++) {
    const offset = t * nVerts;
    const frameValues = source.subarray(offset, offset + nVerts);

    if (mode === "residual") {
      let sum = 0;
      for (let v = 0; v < nVerts; v++) sum += frameValues[v];
      const mean = sum / nVerts;
      for (let v = 0; v < nVerts; v++) {
        out[offset + v] = frameValues[v] - mean;
      }
    } else {
      out.set(frameValues, offset);
    }

    if (mode === "network" && yeoIds && dominantNetworkTr) {
      const targetId = keyToId[dominantNetworkTr[t] ?? ""] ?? 0;
      for (let v = 0; v < nVerts; v++) {
        if (yeoIds[v] !== targetId) {
          out[offset + v] = 0;
        }
      }
    }
  }

  return out;
}

export function concatHemisphereYeo(data: VertexYeoData): number[] {
  return [...data.lh, ...data.rh];
}
