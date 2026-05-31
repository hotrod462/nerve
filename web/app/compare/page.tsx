import Link from "next/link";
import { CompareClient } from "./CompareClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteMetadata } from "@/lib/geo";
import { listRuns } from "@/lib/loadRun";

export const metadata = siteMetadata({
  title: "Compare tracks",
  description:
    "Side-by-side TRIBE v2 predicted brain engagement for two audio clips, with optional A−B contrast maps.",
});

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
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-muted-foreground">
          Select two tracks via query params:{" "}
          <code>/compare?a=egmont&b=forever_edm</code>
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Available tracks</CardTitle>
            <CardDescription>Pick two runs to compare side by side.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-left text-sm">
              {predRuns.map((r) => (
                <li key={r.id}>
                  <Link href={`/tracks/${r.id}`} className="text-primary hover:underline">
                    {r.id}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        Compare: {a} vs {b}
      </h1>
      <CompareClient runA={a} runB={b} contrastId={contrast?.id} />
    </div>
  );
}
