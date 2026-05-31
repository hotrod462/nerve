import { listRuns, readOutputsRunsJson, readRunJson } from "@/lib/loadRun";
import { siteMetadata } from "@/lib/geo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StimulusParcel {
  stimulus_ids: string[];
  data: number[][];
  n_parcels: number;
}

export const metadata = siteMetadata({
  title: "Matrix explorer",
  description:
    "Stimulus × Schaefer parcel mean activation matrix and pairwise L2 similarity across your Nerve library.",
});

export const dynamic = "force-dynamic";

export default async function MatrixPage() {
  const runs = (await listRuns()).filter(
    (r) => r.manifest.stimulus && !r.manifest.contrast
  );

  const matrix = await readOutputsRunsJson<StimulusParcel>("stimulus_parcel.json");

  if (runs.length === 0 && !matrix) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Matrix explorer</h1>
        <p className="text-muted-foreground">
          Run predict + export-web on multiple tracks first.
        </p>
      </div>
    );
  }

  const ids = matrix?.stimulus_ids ?? runs.map((r) => r.manifest.stimulus?.id ?? r.id);

  const rows =
    matrix?.data ??
    (await Promise.all(
      runs.map(async (r) => {
        const p = await readRunJson<{ data: number[][] }>(
          r,
          "matrices/parcel_time.json"
        );
        if (!p?.data) return [];
        return p.data.map((row) => row.reduce((a, b) => a + b, 0) / row.length);
      })
    ));

  const nParcels = matrix?.n_parcels ?? (rows[0]?.length ?? 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Matrix explorer</h1>
        <p className="text-sm text-muted-foreground">
          Stimulus × parcel ({ids.length}×{nParcels})
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stimulus</TableHead>
                <TableHead colSpan={Math.min(20, nParcels)}>
                  Parcels (first 20)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ids.map((id, ri) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{id}</TableCell>
                  {(rows[ri] ?? []).slice(0, 20).map((v, ci) => (
                    <TableCell
                      key={ci}
                      className="text-xs tabular-nums"
                      style={{
                        background: `rgba(124, 172, 248, ${Math.min(1, Math.abs(v) * 5)})`,
                      }}
                    >
                      {v.toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stimulus similarity (L2)</CardTitle>
          <CardDescription>Pairwise distance heatmap across stimuli.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimilarityGrid ids={ids} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function SimilarityGrid({ ids, rows }: { ids: string[]; rows: number[][] }) {
  const n = ids.length;
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = rows[i] ?? [];
      const b = rows[j] ?? [];
      let s = 0;
      for (let k = 0; k < Math.min(a.length, b.length); k++) {
        const d = a[k] - b[k];
        s += d * d;
      }
      dist[i][j] = Math.sqrt(s);
    }
  }

  const max = Math.max(...dist.flat(), 1e-6);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          {ids.map((id) => (
            <TableHead key={id} className="max-w-20 truncate">
              {id.slice(0, 12)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ids.map((id, i) => (
          <TableRow key={id}>
            <TableCell className="font-medium">{id.slice(0, 14)}</TableCell>
            {ids.map((_, j) => (
              <TableCell
                key={j}
                className="p-1.5"
                style={{
                  background: `rgba(240, 120, 80, ${dist[i][j] / max})`,
                }}
                title={dist[i][j].toFixed(3)}
              />
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
