export interface SubcorticalRegionTrace {
  roi_key: string;
  headline: string;
  tagline: string;
  raw: number[];
  zscore: number[];
  derivative: number[];
}

export interface SubcorticalRegionSummary {
  mean_z: number;
  peak_z: number;
  peak_tr: number;
  active_fraction: number;
}

export interface SubcorticalEngagementData {
  version: number;
  fps: number;
  n_trs: number;
  atlas: {
    name: string;
    n_voxels: number;
    n_rois: number;
  };
  inference_mode: string;
  preprocessing: {
    aggregate: string;
    zscore: string;
  };
  regions: Record<string, SubcorticalRegionTrace>;
  summaries: Record<string, SubcorticalRegionSummary>;
  derived: {
    dominant_roi_tr: string[];
    display_order: string[];
    roi_order: string[];
  };
  disclaimer: string;
}

/** Display order — excludes lateral ventricle (CSF). */
export const SUBCORTICAL_DISPLAY_ORDER = [
  "Accumbens",
  "Caudate",
  "Putamen",
  "Pallidum",
  "Amygdala",
  "Hippocampus",
  "Thalamus",
] as const;

export const SUBCORTICAL_COLORS: Record<string, string> = {
  Accumbens: "rgb(255, 193, 37)",
  Caudate: "rgb(255, 140, 50)",
  Putamen: "rgb(70, 130, 220)",
  Pallidum: "rgb(150, 100, 220)",
  Amygdala: "rgb(230, 60, 120)",
  Hippocampus: "rgb(60, 180, 120)",
  Thalamus: "rgb(80, 200, 200)",
  "Lateral Ventricle": "rgb(140, 140, 140)",
};

export interface SubcorticalDescription {
  yeoLabel: string;
  paragraphs: string[];
}

export const SUBCORTICAL_DESCRIPTIONS: Record<
  (typeof SUBCORTICAL_DISPLAY_ORDER)[number],
  SubcorticalDescription
> = {
  Accumbens: {
    yeoLabel: "Nucleus accumbens",
    paragraphs: [
      "The accumbens is a core reward hub — pleasure, wanting, and peak emotional moments in music.",
      "In-silico elevation may track drops, chorus hits, or passages that feel intensely rewarding.",
    ],
  },
  Caudate: {
    yeoLabel: "Caudate nucleus",
    paragraphs: [
      "The caudate supports predictive reward and timing — anticipating the next beat or harmonic resolution.",
    ],
  },
  Putamen: {
    yeoLabel: "Putamen",
    paragraphs: [
      "The putamen couples rhythm and motor reward — groove, entrainment, and danceable passages.",
    ],
  },
  Pallidum: {
    yeoLabel: "Globus pallidus",
    paragraphs: [
      "Pallidal activity reflects motor–reward integration during sustained rhythmic engagement.",
    ],
  },
  Amygdala: {
    yeoLabel: "Amygdala",
    paragraphs: [
      "The amygdala tags emotional salience — tension, surprise, and affective arousal beyond cortical Feeling.",
    ],
  },
  Hippocampus: {
    yeoLabel: "Hippocampus",
    paragraphs: [
      "Hippocampal engagement is linked to familiarity, memory, and nostalgic or story-like listening.",
    ],
  },
  Thalamus: {
    yeoLabel: "Thalamus",
    paragraphs: [
      "The thalamus relays sensory and arousal signals — a coarse proxy for overall subcortical drive.",
    ],
  },
};

export function subcorticalRegionsInOrder(
  data: SubcorticalEngagementData
): SubcorticalRegionTrace[] {
  const order = data.derived.display_order?.length
    ? data.derived.display_order
    : [...SUBCORTICAL_DISPLAY_ORDER];
  return order.map((key) => data.regions[key]).filter(Boolean);
}
