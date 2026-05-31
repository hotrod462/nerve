"use client";

import {
  SUBCORTICAL_COLORS,
  SUBCORTICAL_DESCRIPTIONS,
  SUBCORTICAL_DISPLAY_ORDER,
  type SubcorticalEngagementData,
  type SubcorticalRegionTrace,
} from "@/lib/subcortical";
import type { AcousticFeaturesData } from "@/lib/engagement";
import { ACOUSTIC_OVERLAY_COLORS } from "@/lib/engagement";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

interface SubcorticalEngagementTimelineProps {
  subcortical: SubcorticalEngagementData;
  acoustic?: AcousticFeaturesData | null;
  currentFrame?: number;
  onSeek?: (frame: number) => void;
}

const CHART_W = 320;
const CHART_H = 32;
const PAD_X = 2;
const PAD_Y = 4;
const ACOUSTIC_OVERLAY_ALPHA = 0.45;

function tracePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;
  const zMin = Math.min(-2, ...values);
  const zMax = Math.max(2, ...values);
  const span = zMax - zMin || 1;
  const points = values.map((v, i) => {
    const x = PAD_X + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = PAD_Y + innerH - ((v - zMin) / span) * innerH;
    return `${x},${y}`;
  });
  return `M ${points.join(" L ")}`;
}

function RegionRow({
  roi,
  trace,
  nTrs,
  color,
  dominantRoiTr,
  currentFrame,
  onSeek,
  acoustic,
  showAcoustic,
}: {
  roi: string;
  trace: SubcorticalRegionTrace;
  nTrs: number;
  color: string;
  dominantRoiTr: string[];
  currentFrame: number;
  onSeek?: (frame: number) => void;
  acoustic?: AcousticFeaturesData | null;
  showAcoustic: boolean;
}) {
  const playheadX =
    nTrs > 1
      ? PAD_X + (currentFrame / (nTrs - 1)) * (CHART_W - PAD_X * 2)
      : PAD_X;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek || nTrs <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - PAD_X;
    const innerW = CHART_W - PAD_X * 2;
    const t = Math.round((x / innerW) * (nTrs - 1));
    onSeek(Math.max(0, Math.min(nTrs - 1, t)));
  };

  const description =
    SUBCORTICAL_DESCRIPTIONS[roi as keyof typeof SUBCORTICAL_DESCRIPTIONS];
  const peak = trace.zscore.length ? Math.max(...trace.zscore) : 0;
  const peakTr = trace.zscore.length
    ? trace.zscore.indexOf(Math.max(...trace.zscore))
    : 0;

  return (
    <Collapsible className="engagement-row-block">
      <div className="engagement-row">
        <div className="engagement-row__label">
          <span
            className="engagement-row__swatch"
            style={{ background: color }}
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <CollapsibleTrigger className="engagement-row__trigger group/trigger">
              <span className="engagement-row__headline">{trace.headline}</span>
              <ChevronDownIcon className="engagement-row__chevron" aria-hidden />
            </CollapsibleTrigger>
            <div className="engagement-row__tagline">{trace.tagline}</div>
          </div>
        </div>
        <div className="engagement-row__chart-wrap">
          <svg
            className="engagement-row__chart"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            width="100%"
            height={CHART_H}
            onClick={handleClick}
            role="img"
            aria-label={`${trace.headline} subcortical engagement`}
          >
            <line
              x1={PAD_X}
              y1={CHART_H / 2}
              x2={CHART_W - PAD_X}
              y2={CHART_H / 2}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray="2 3"
            />
            {showAcoustic && acoustic
              ? acoustic.feature_order.map((key) => {
                  const feat = acoustic.features[key];
                  if (!feat) return null;
                  return (
                    <path
                      key={key}
                      d={tracePath(feat.zscore, CHART_W, CHART_H)}
                      fill="none"
                      stroke={ACOUSTIC_OVERLAY_COLORS[key] ?? "var(--muted-foreground)"}
                      strokeWidth={1}
                      opacity={ACOUSTIC_OVERLAY_ALPHA}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })
              : null}
            <path
              d={tracePath(trace.zscore, CHART_W, CHART_H)}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={CHART_H}
              stroke="var(--foreground)"
              strokeWidth={1}
              opacity={0.85}
            />
          </svg>
          <div className="engagement-row__stats">
            <span>{trace.zscore[currentFrame]?.toFixed(2) ?? "—"}</span>
            <span className="engagement-row__stats-muted">
              peak {peak.toFixed(2)} @ {peakTr}s
            </span>
          </div>
        </div>
      </div>
      {description ? (
        <CollapsibleContent className="engagement-row__detail">
          <p className="engagement-row__detail-label">{description.yeoLabel}</p>
          {description.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export function SubcorticalEngagementTimeline({
  subcortical,
  acoustic,
  currentFrame = 0,
  onSeek,
}: SubcorticalEngagementTimelineProps) {
  const [showAcoustic, setShowAcoustic] = useState(false);
  const frame = Math.max(0, Math.min(subcortical.n_trs - 1, currentFrame));
  const dominantRoi = subcortical.derived.dominant_roi_tr[frame] ?? "—";
  const dominantColor =
    SUBCORTICAL_COLORS[dominantRoi] ?? "var(--foreground)";
  const displayOrder = subcortical.derived.display_order?.length
    ? subcortical.derived.display_order
    : [...SUBCORTICAL_DISPLAY_ORDER];

  return (
    <Card className="mt-4">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Subcortical engagement</CardTitle>
          <CardDescription>{subcortical.disclaimer}</CardDescription>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-col items-start gap-0.5 sm:items-end">
            <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              Now
            </span>
            <span
              className="text-lg font-semibold"
              style={{ color: dominantColor }}
            >
              {subcortical.regions[dominantRoi]?.headline ?? dominantRoi}
            </span>
          </div>
          {acoustic ? (
            <Toggle
              size="sm"
              pressed={showAcoustic}
              onPressedChange={setShowAcoustic}
              aria-label="Toggle acoustic overlay on subcortical charts"
              className="text-xs"
            >
              Acoustic overlay
            </Toggle>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="engagement-rows">
          {displayOrder.map((roi) => {
            const trace = subcortical.regions[roi];
            if (!trace) return null;
            return (
              <RegionRow
                key={roi}
                roi={roi}
                trace={trace}
                nTrs={subcortical.n_trs}
                color={SUBCORTICAL_COLORS[roi] ?? "var(--primary)"}
                dominantRoiTr={subcortical.derived.dominant_roi_tr}
                currentFrame={frame}
                onSeek={onSeek}
                acoustic={acoustic}
                showAcoustic={showAcoustic}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
