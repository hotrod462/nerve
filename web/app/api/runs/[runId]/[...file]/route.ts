import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/loadRun";

const MIME: Record<string, string> = {
  ".gii": "application/octet-stream",
  ".json": "application/json",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; file: string[] }> }
) {
  const { runId, file } = await params;
  const run = getRun(runId);
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
