import Link from "next/link";
import { CompareClient } from "./CompareClient";
import { listRuns } from "@/lib/loadRun";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const runs = listRuns();
  const predRuns = runs.filter((r) => !r.manifest.contrast && r.manifest.stimulus);
  const contrastRuns = runs.filter((r) => r.manifest.contrast);

  const a = sp.a ?? predRuns[0]?.id;
  const b = sp.b ?? predRuns[1]?.id;
  const contrast = contrastRuns.find(
    (r) => r.manifest.contrast?.a === a && r.manifest.contrast?.b === b
  );

  if (!a || !b) {
    return (
      <div className="empty">
        <h1>Compare</h1>
        <p>Select two tracks via query params: /compare?a=egmont&b=forever_edm</p>
        <ul>
          {predRuns.map((r) => (
            <li key={r.id}>
              <Link href={`/tracks/${r.id}`}>{r.id}</Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h1>
        Compare: {a} vs {b}
      </h1>
      <CompareClient runA={a} runB={b} contrastId={contrast?.id} />
    </div>
  );
}
