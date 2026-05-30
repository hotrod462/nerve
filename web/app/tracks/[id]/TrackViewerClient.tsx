"use client";

import dynamic from "next/dynamic";
import type { BrainViewerProps } from "@/components/BrainViewer";

const BrainViewer = dynamic(
  () => import("@/components/BrainViewer").then((m) => m.BrainViewer),
  { ssr: false }
);

export function TrackViewerClient(props: BrainViewerProps & { totalFrames: number }) {
  return <BrainViewer {...props} />;
}
