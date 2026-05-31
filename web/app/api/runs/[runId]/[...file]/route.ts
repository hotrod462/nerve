import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/loadRun";
import { isRemoteAssets } from "@/lib/assets";

/** Local dev fallback when NEXT_PUBLIC_NERVE_ASSETS_BASE is unset. */

const MIME: Record<string, string> = {
  ".gii": "application/octet-stream",
  ".json": "application/json",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; file: string[] }> }
) {
  const { runId, file } = await params;
  if (isRemoteAssets()) {
    return NextResponse.json(
      { error: "Use NEXT_PUBLIC_NERVE_ASSETS_BASE URLs in remote mode" },
      { status: 404 }
    );
  }
  const run = await getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const rel = file.join("/");
  const filePath = path.join(run.webDir, rel);
  if (!filePath.startsWith(run.webDir) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(filePath);
  const body = fs.readFileSync(filePath);
  return new NextResponse(body, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
