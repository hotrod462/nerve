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
  };
  networks: Record<string, NetworkEngagementTrace>;
  summaries: Record<string, NetworkSummary>;
  derived: {
    dominant_network_tr: string[];
    coupling: Record<
      string,
      { networks: string[]; window_s: number; series: number[] }
    >;
    salience_events: {
      threshold_z_derivative: number;
      trs: number[];
    };
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
