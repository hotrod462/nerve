import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { REPO_ROOT } from "@/lib/loadRun";

const MIME: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const rel = segments.join("/");
  const filePath = path.resolve(REPO_ROOT, rel);

  if (!filePath.startsWith(REPO_ROOT) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(filePath);
  const body = fs.readFileSync(filePath);
  return new NextResponse(body, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
