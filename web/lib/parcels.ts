export interface ParcelTimeData {
  n_parcels: number;
  n_trs: number;
  data: number[][];
  labels: string[];
  networks?: string[];
}

export function yeoSummary(
  data: number[][],
  networks: string[]
): Record<string, number> {
  const sums: Record<string, { total: number; count: number }> = {};
  for (let p = 0; p < data.length; p++) {
    const net = networks[p] || "Unknown";
    const mean = data[p].reduce((a, b) => a + b, 0) / data[p].length;
    if (!sums[net]) sums[net] = { total: 0, count: 0 };
    sums[net].total += mean;
    sums[net].count += 1;
  }
  const out: Record<string, number> = {};
  for (const [net, { total, count }] of Object.entries(sums)) {
    out[net] = total / Math.max(count, 1);
  }
  return out;
}
