export interface NetworkEngagementTrace {
  yeo_key: string;
  headline: string;
  tagline: string;
  parcel_count: number;
  raw: number[];
  zscore: number[];
  derivative: number[];
}

export interface NetworkSummary {
  mean_z: number;
  peak_z: number;
  peak_tr: number;
  active_fraction: number;
}

export interface DominantSegment {
  net: string;
  start_tr: number;
  end_tr: number;
  duration_s: number;
}

export interface EpochTemplate {
  id: string;
  label: string;
  hypothesis: string;
  score: number;
  caveat: string;
}

export interface EpochSegment {
  net: string;
  start_tr: number;
  end_tr: number;
  duration_s: number;
  template?: EpochTemplate;
}

export interface AcousticFeatureTrace {
  label: string;
  description: string;
  raw: number[];
  zscore: number[];
}

export interface AcousticFeaturesData {
  version: number;
  fps: number;
  n_trs: number;
  source: string;
  feature_order: string[];
  features: Record<string, AcousticFeatureTrace>;
  disclaimer: string;
}

export interface EngagementData {
  version: number;
  fps: number;
  n_trs: number;
  atlas: {
    name: string;
    n_parcels: number;
    yeo_networks: number;
  };
  inference_mode: string;
  preprocessing: {
    network_aggregate: string;
    zscore: string;
    skip_trs: number;
    macro_rollup?: boolean;
  };
  networks: Record<string, NetworkEngagementTrace>;
  subnetworks?: Record<string, NetworkEngagementTrace>;
  sub_summaries?: Record<string, NetworkSummary>;
  summaries: Record<string, NetworkSummary>;
  derived: {
    dominant_network_tr: string[];
    dominant_segments?: DominantSegment[];
    epoch_segments?: EpochSegment[];
    coupling: Record<
      string,
      { networks: string[]; window_s: number; series: number[] }
    >;
    salience_events: {
      threshold_z_derivative: number;
      trs: number[];
    };
    deep_dive_subnets?: Record<string, string[]>;
  };
  disclaimer: string;
}

/** Yeo-7 display order — matches backend YEO_NETWORK_ORDER. */
export const ENGAGEMENT_NETWORK_ORDER = [
  "Cont",
  "SalVentAttn",
  "DorsAttn",
  "Default",
  "Limbic",
  "SomMot",
  "Vis",
] as const;

/** Connectome Workbench / Schaefer Yeo-7 colors (CSS rgb). */
export const ENGAGEMENT_COLORS: Record<string, string> = {
  Vis: "rgb(120, 18, 134)",
  SomMot: "rgb(70, 130, 180)",
  DorsAttn: "rgb(0, 118, 14)",
  SalVentAttn: "rgb(230, 148, 34)",
  Limbic: "rgb(220, 0, 115)",
  Cont: "rgb(120, 94, 224)",
  Default: "rgb(255, 0, 0)",
};

export function engagementNetworksInOrder(
  data: EngagementData
): NetworkEngagementTrace[] {
  return ENGAGEMENT_NETWORK_ORDER.map((key) => data.networks[key]).filter(Boolean);
}

/** Format seconds as m:ss for segment labels. */
export function formatSegmentTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse dominant-network runs from per-TR labels (fallback if segments absent). */
export function parseDominantSegments(
  dominantNetworkTr: string[]
): DominantSegment[] {
  if (dominantNetworkTr.length === 0) return [];

  const segments: DominantSegment[] = [];
  let start = 0;
  let current = dominantNetworkTr[0];

  for (let i = 1; i < dominantNetworkTr.length; i++) {
    if (dominantNetworkTr[i] !== current) {
      segments.push({
        net: current,
        start_tr: start,
        end_tr: i - 1,
        duration_s: i - start,
      });
      start = i;
      current = dominantNetworkTr[i];
    }
  }

  segments.push({
    net: current,
    start_tr: start,
    end_tr: dominantNetworkTr.length - 1,
    duration_s: dominantNetworkTr.length - start,
  });

  return segments;
}

export function getDominantSegments(data: EngagementData): DominantSegment[] {
  if (data.derived.dominant_segments?.length) {
    return data.derived.dominant_segments;
  }
  return parseDominantSegments(data.derived.dominant_network_tr);
}

export function networkFractions(
  dominantNetworkTr: string[]
): Record<string, number> {
  if (dominantNetworkTr.length === 0) return {};
  const counts: Record<string, number> = {};
  for (const net of dominantNetworkTr) {
    counts[net] = (counts[net] ?? 0) + 1;
  }
  const n = dominantNetworkTr.length;
  return Object.fromEntries(
    Object.entries(counts).map(([net, c]) => [net, c / n])
  );
}

export interface NetworkEngagementDescription {
  /** Yeo-7 network name for readers who want the neuroscience label. */
  yeoLabel: string;
  /** Short paragraphs shown when a row is expanded. */
  paragraphs: string[];
}

/** Expanded copy for each headline metric (frontend-only). */
export const ENGAGEMENT_DESCRIPTIONS: Record<
  (typeof ENGAGEMENT_NETWORK_ORDER)[number],
  NetworkEngagementDescription
> = {
  Cont: {
    yeoLabel: "Control network",
    paragraphs: [
      "The control network coordinates executive processes: holding goals in mind, resolving competition between responses, and regulating other networks. It is often engaged when a task requires sustained effort or flexible updating.",
      "In music, Focus may rise during dense or structurally complex passages—polyphony, rapid lyrical delivery, or sections that invite active parsing rather than background listening.",
      "Each point is the mean predicted BOLD-like signal across Schaefer parcels mapped to Yeo-7 Control, z-scored within this clip so you can compare moments relative to the track itself.",
    ],
  },
  SalVentAttn: {
    yeoLabel: "Salience / ventral attention network",
    paragraphs: [
      "The salience network detects events that stand out from the ongoing stream and helps reorient attention. It is central to bottom-up surprise, novelty, and salient sensory change.",
      "Surprise often spikes at drops, entry of a new timbre, sudden dynamic shifts, or boundary moments between sections. Sharp upward moves in this trace are also used to flag salience events elsewhere in the panel.",
      "This trace aggregates parcels in Yeo-7 Salience/Ventral Attention and is z-scored within the clip.",
    ],
  },
  DorsAttn: {
    yeoLabel: "Dorsal attention network",
    paragraphs: [
      "The dorsal attention network supports top-down, goal-directed attention: selecting what to follow in a noisy environment and maintaining that focus over time.",
      "Tracking may stay elevated when a lead melody, rhythm, or motif holds your attention across bars—steady grooves, repeating hooks, or passages you are deliberately following.",
      "Values come from Yeo-7 Dorsal Attention parcels, averaged and z-scored within the clip.",
    ],
  },
  Default: {
    yeoLabel: "Default mode network",
    paragraphs: [
      "The default mode network is associated with internally directed thought: autobiographical memory, narrative construction, and self-relevant interpretation. It often quiets during demanding external tasks but can re-engage during rich, meaningful experience.",
      "Resonance may increase when music feels personal, story-like, or emotionally reflective—lyrical meaning, nostalgic tone, or passages that invite imagination beyond the sound itself.",
      "This trace reflects Yeo-7 Default network parcels, z-scored within the clip.",
    ],
  },
  Limbic: {
    yeoLabel: "Limbic network",
    paragraphs: [
      "Limbic-related cortex supports affective evaluation—pleasure, tension, reward anticipation, and emotional coloring of experience. It interacts closely with memory and motivational systems.",
      "Feeling may track harmonic warmth, vocal expressiveness, lyrical valence, or build-and-release dynamics that carry emotional weight rather than purely sensory surprise.",
      "Aggregated from Yeo-7 Limbic parcels and z-scored within the clip.",
    ],
  },
  SomMot: {
    yeoLabel: "Somatomotor network",
    paragraphs: [
      "The somatomotor network spans primary and supplementary motor regions plus related somatosensory areas. It is engaged by movement planning, rhythmic timing, and sensorimotor coupling.",
      "Pulse often follows beat strength, syncopation, and groove—sections that invite foot-tapping, dance, or internal entrainment to the rhythm.",
      "Derived from Yeo-7 Somatomotor parcels, averaged and z-scored within the clip.",
    ],
  },
  Vis: {
    yeoLabel: "Visual network",
    paragraphs: [
      "The visual network processes visual input and supports internally generated visual imagery. Auditory stimuli can co-engage visual cortex when listening evokes scenes, motion, or vivid timbral “color.”",
      "Imagery may rise with cinematic production, spatial mixing, or passages that feel visually evocative—even without any video present.",
      "This trace averages Yeo-7 Visual parcels and is z-scored within the clip.",
    ],
  },
};

/** Key Yeo-17 subnetworks shown under each macro headline row. */
export const MACRO_DEEP_DIVE_SUBNETS: Record<
  (typeof ENGAGEMENT_NETWORK_ORDER)[number],
  readonly string[]
> = {
  Cont: ["ContA", "ContB", "ContC"],
  SalVentAttn: ["SalVentAttnA", "SalVentAttnB"],
  DorsAttn: ["DorsAttnA", "DorsAttnB"],
  Default: ["DefaultA", "DefaultB", "DefaultC", "TempPar"],
  Limbic: ["LimbicA", "LimbicB"],
  SomMot: ["SomMotA", "SomMotB"],
  Vis: ["VisCent", "VisPeri"],
};

export const SUBNETWORK_COLORS: Record<string, string> = {
  VisCent: "rgb(120, 18, 134)",
  VisPeri: "rgb(160, 60, 170)",
  SomMotA: "rgb(70, 130, 180)",
  SomMotB: "rgb(110, 160, 205)",
  DorsAttnA: "rgb(0, 118, 14)",
  DorsAttnB: "rgb(40, 160, 50)",
  SalVentAttnA: "rgb(230, 148, 34)",
  SalVentAttnB: "rgb(255, 190, 90)",
  LimbicA: "rgb(220, 0, 115)",
  LimbicB: "rgb(255, 80, 150)",
  ContA: "rgb(120, 94, 224)",
  ContB: "rgb(150, 120, 235)",
  ContC: "rgb(180, 150, 245)",
  DefaultA: "rgb(255, 0, 0)",
  DefaultB: "rgb(255, 80, 80)",
  DefaultC: "rgb(255, 130, 130)",
  TempPar: "rgb(200, 40, 40)",
};

export const SUBNETWORK_DESCRIPTIONS: Record<string, NetworkEngagementDescription> = {
  SalVentAttnA: {
    yeoLabel: "Salience A — anterior insula / cingulate",
    paragraphs: [
      "SalVentAttnA includes anterior insula and mid-cingulate regions central to interoceptive salience and bottom-up event detection.",
      "In music, this subnetwork is the best cortical proxy for sudden orienting — drops, boundary accents, and timbral shocks (when not averaged away into the macro salience trace).",
    ],
  },
  SalVentAttnB: {
    yeoLabel: "Salience B — ventral attention / TPJ",
    paragraphs: [
      "SalVentAttnB overlaps ventral attention and temporoparietal junction — reorienting after an event rather than the initial insula spike.",
    ],
  },
  DefaultA: {
    yeoLabel: "Default A — medial prefrontal core",
    paragraphs: [
      "DefaultA is the medial prefrontal hub of the DMN — self-relevant interpretation and narrative framing during listening.",
    ],
  },
  DefaultB: {
    yeoLabel: "Default B — temporal / angular DMN",
    paragraphs: [
      "DefaultB spans lateral temporal and angular regions tied to semantic association and episodic context.",
    ],
  },
  DefaultC: {
    yeoLabel: "Default C — posterior DMN",
    paragraphs: [
      "DefaultC is a posterior DMN hub — integration of autobiographical and scene-like imagery while music unfolds.",
    ],
  },
  TempPar: {
    yeoLabel: "Temporal parietal — language / narrative",
    paragraphs: [
      "TempPar bridges temporal and parietal language networks. It often co-elevates with DefaultA when lyrics or semantic narrative is foregrounded.",
    ],
  },
  ContA: {
    yeoLabel: "Control A — frontoparietal",
    paragraphs: [
      "ContA is the classic frontoparietal control system — sustained effort when parsing dense musical structure.",
    ],
  },
  ContB: {
    yeoLabel: "Control B — cingulo-insular control",
    paragraphs: [
      "ContB links mid-cingulate and insular control — flexible updating when the musical stream shifts.",
    ],
  },
  ContC: {
    yeoLabel: "Control C — posterior control",
    paragraphs: [
      "ContC supports posterior control processes — maintaining task sets across longer passages.",
    ],
  },
  DorsAttnA: {
    yeoLabel: "Dorsal attention A",
    paragraphs: ["Frontoparietal top-down selection — following a lead line or motif."],
  },
  DorsAttnB: {
    yeoLabel: "Dorsal attention B",
    paragraphs: ["Posterior dorsal attention — spatial / spectral tracking of ongoing texture."],
  },
  SomMotA: {
    yeoLabel: "Somatomotor A",
    paragraphs: ["Primary motor and premotor — beat entrainment and movement planning."],
  },
  SomMotB: {
    yeoLabel: "Somatomotor B",
    paragraphs: ["Extended somatomotor — secondary rhythmic coupling."],
  },
  LimbicA: {
    yeoLabel: "Limbic A — orbitofrontal / temporal pole",
    paragraphs: ["Affective evaluation and reward tone — warmth, tension, valence."],
  },
  LimbicB: {
    yeoLabel: "Limbic B — cingulate / parahippocampal",
    paragraphs: ["Emotional memory coloring and anticipatory affect."],
  },
  VisCent: {
    yeoLabel: "Central visual",
    paragraphs: ["Early visual cortex — vivid timbral color and centrally imagined scenes."],
  },
  VisPeri: {
    yeoLabel: "Peripheral visual",
    paragraphs: ["Peripheral visual field — spatial / panoramic imagery from production."],
  },
};

export const ACOUSTIC_OVERLAY_COLORS: Record<string, string> = {
  rms: "rgb(255, 210, 80)",
  spectral_centroid: "rgb(120, 200, 255)",
  spectral_flux: "rgb(180, 255, 140)",
  onset_strength: "rgb(255, 120, 160)",
};

export function getEpochSegments(data: EngagementData): EpochSegment[] {
  if (data.derived.epoch_segments?.length) {
    return data.derived.epoch_segments;
  }
  return getDominantSegments(data).map((seg) => ({ ...seg }));
}

export function epochTemplateForSegment(
  data: EngagementData,
  segment: DominantSegment
): EpochTemplate | undefined {
  const match = getEpochSegments(data).find(
    (s) =>
      s.net === segment.net &&
      s.start_tr === segment.start_tr &&
      s.end_tr === segment.end_tr
  );
  return match?.template;
}

export function deepDiveSubnets(
  data: EngagementData,
  macro: (typeof ENGAGEMENT_NETWORK_ORDER)[number]
): string[] {
  const fromExport = data.derived.deep_dive_subnets?.[macro];
  if (fromExport?.length) return fromExport;
  return [...MACRO_DEEP_DIVE_SUBNETS[macro]];
}
