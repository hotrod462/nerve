"use client";

import { useState } from "react";
import {
  ACOUSTIC_OVERLAY_COLORS,
  ENGAGEMENT_COLORS,
  ENGAGEMENT_DESCRIPTIONS,
  ENGAGEMENT_NETWORK_ORDER,
  SUBNETWORK_COLORS,
  SUBNETWORK_DESCRIPTIONS,
  deepDiveSubnets,
  type AcousticFeaturesData,
  type EngagementData,
  type NetworkEngagementTrace,
} from "@/lib/engagement";
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
import { DominantSegmentTimeline } from "@/components/DominantSegmentTimeline";
import { EngagementSummaries } from "@/components/EngagementSummaries";

interface EngagementTimelineProps {
  engagement: EngagementData;
  acoustic?: AcousticFeaturesData | null;
  currentFrame?: number;
  onSeek?: (frame: number) => void;
  className?: string;
}

const CHART_W = 320;
const CHART_H = 36;
const SUB_CHART_H = 28;
const PAD_X = 2;
const PAD_Y = 4;
const DOMINANT_FILL_ALPHA = 0.22;
const ACOUSTIC_OVERLAY_ALPHA = 0.45;

function fadedNetworkColor(color: string, alpha = DOMINANT_FILL_ALPHA): string {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  }
  return color;
}

function trSpanRect(
  start: number,
  end: number,
  nTrs: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const innerW = width - PAD_X * 2;
  const step = nTrs > 1 ? innerW / (nTrs - 1) : innerW;
  const xStart = PAD_X + (start / Math.max(nTrs - 1, 1)) * innerW - step / 2;
  const xEnd = PAD_X + (end / Math.max(nTrs - 1, 1)) * innerW + step / 2;

  return {
    x: Math.max(PAD_X, xStart),
    y: 0,
    width: Math.min(width - PAD_X, xEnd) - Math.max(PAD_X, xStart),
    height,
  };
}

function dominantSegments(
  dominantNetworkTr: string[],
  net: string
): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = [];
  let start: number | null = null;

  for (let i = 0; i < dominantNetworkTr.length; i++) {
    if (dominantNetworkTr[i] === net) {
      if (start === null) start = i;
    } else if (start !== null) {
      segments.push({ start, end: i - 1 });
      start = null;
    }
  }

  if (start !== null) {
    segments.push({ start, end: dominantNetworkTr.length - 1 });
  }

  return segments;
}

function tracePath(
  values: number[],
  width: number,
  height: number,
  strokeWidth = 1.5
): string {
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

function EngagementChart({
  trace,
  nTrs,
  color,
  dominantNetworkTr,
  net,
  currentFrame,
  onSeek,
  height = CHART_H,
  acousticOverlay,
  showAcoustic,
}: {
  trace: NetworkEngagementTrace;
  nTrs: number;
  color: string;
  dominantNetworkTr: string[];
  net: string;
  currentFrame: number;
  onSeek?: (frame: number) => void;
  height?: number;
  acousticOverlay?: AcousticFeaturesData | null;
  showAcoustic?: boolean;
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

  const dominantSegmentsForNet = dominantSegments(dominantNetworkTr, net);
  const dominantFill = fadedNetworkColor(color);

  return (
    <svg
      className="engagement-row__chart"
      viewBox={`0 0 ${CHART_W} ${height}`}
      width="100%"
      height={height}
      onClick={handleClick}
      role="img"
      aria-label={`${trace.headline} engagement over time`}
    >
      {dominantSegmentsForNet.map(({ start, end }) => {
        const rect = trSpanRect(start, end, nTrs, CHART_W, height);
        return (
          <rect
            key={`${start}-${end}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={dominantFill}
          />
        );
      })}
      <line
        x1={PAD_X}
        y1={height / 2}
        x2={CHART_W - PAD_X}
        y2={height / 2}
        stroke="var(--border)"
        strokeWidth={0.5}
        strokeDasharray="2 3"
      />
      {showAcoustic && acousticOverlay
        ? acousticOverlay.feature_order.map((key) => {
            const feat = acousticOverlay.features[key];
            if (!feat) return null;
            return (
              <path
                key={key}
                d={tracePath(feat.zscore, CHART_W, height, 1)}
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
        d={tracePath(trace.zscore, CHART_W, height)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={playheadX}
        y1={0}
        x2={playheadX}
        y2={height}
        stroke="var(--foreground)"
        strokeWidth={1}
        opacity={0.85}
      />
    </svg>
  );
}

function NetworkRow({
  net,
  trace,
  engagement,
  acoustic,
  showAcoustic,
  nTrs,
  color,
  dominantNetworkTr,
  currentFrame,
  onSeek,
}: {
  net: (typeof ENGAGEMENT_NETWORK_ORDER)[number];
  trace: NetworkEngagementTrace;
  engagement: EngagementData;
  acoustic?: AcousticFeaturesData | null;
  showAcoustic: boolean;
  nTrs: number;
  color: string;
  dominantNetworkTr: string[];
  currentFrame: number;
  onSeek?: (frame: number) => void;
}) {
  const summary = trace.zscore.length
    ? {
        peak: Math.max(...trace.zscore),
        peakTr: trace.zscore.indexOf(Math.max(...trace.zscore)),
      }
    : { peak: 0, peakTr: 0 };

  const description = ENGAGEMENT_DESCRIPTIONS[net];
  const subKeys = deepDiveSubnets(engagement, net);
  const hasSubnetworks = Boolean(engagement.subnetworks);

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
              <ChevronDownIcon
                className="engagement-row__chevron"
                aria-hidden
              />
              <span className="sr-only">
                {description
                  ? `About ${trace.headline} (${description.yeoLabel})`
                  : `About ${trace.headline}`}
              </span>
            </CollapsibleTrigger>
            <div className="engagement-row__tagline">{trace.tagline}</div>
          </div>
        </div>
        <div className="engagement-row__chart-wrap">
          <EngagementChart
            trace={trace}
            nTrs={nTrs}
            color={color}
            dominantNetworkTr={dominantNetworkTr}
            net={net}
            currentFrame={currentFrame}
            onSeek={onSeek}
            acousticOverlay={acoustic}
            showAcoustic={showAcoustic}
          />
          <div className="engagement-row__stats">
            <span title="Within-clip z-score at playhead">
              {trace.zscore[currentFrame]?.toFixed(2) ?? "—"}
            </span>
            <span className="engagement-row__stats-muted" title="Peak z-score">
              peak {summary.peak.toFixed(2)} @ {summary.peakTr}s
            </span>
          </div>
        </div>
      </div>
      <CollapsibleContent className="engagement-row__detail">
        {description ? (
          <>
            <p className="engagement-row__detail-label">{description.yeoLabel}</p>
            {description.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </>
        ) : null}

        {hasSubnetworks ? (
          <div className="engagement-subnets">
            <p className="engagement-subnets__title">Yeo-17 deep dive</p>
            {subKeys.map((subKey) => {
              const subTrace = engagement.subnetworks?.[subKey];
              if (!subTrace) return null;
              const subColor =
                SUBNETWORK_COLORS[subKey] ?? "var(--muted-foreground)";
              const subDesc = SUBNETWORK_DESCRIPTIONS[subKey];
              return (
                <Collapsible key={subKey} className="engagement-subnet-row">
                  <div className="engagement-subnet-row__head">
                    <CollapsibleTrigger className="engagement-subnet-row__trigger">
                      <span
                        className="engagement-row__swatch"
                        style={{ background: subColor }}
                        aria-hidden
                      />
                      <span className="engagement-subnet-row__label">
                        {subTrace.headline}
                      </span>
                      <ChevronDownIcon
                        className="engagement-row__chevron"
                        aria-hidden
                      />
                    </CollapsibleTrigger>
                    <EngagementChart
                      trace={subTrace}
                      nTrs={nTrs}
                      color={subColor}
                      dominantNetworkTr={dominantNetworkTr}
                      net={net}
                      currentFrame={currentFrame}
                      onSeek={onSeek}
                      height={SUB_CHART_H}
                      acousticOverlay={acoustic}
                      showAcoustic={showAcoustic}
                    />
                  </div>
                  {subDesc ? (
                    <CollapsibleContent className="engagement-subnet-row__detail">
                      <p className="engagement-row__detail-label">
                        {subDesc.yeoLabel}
                      </p>
                      {subDesc.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </CollapsibleContent>
                  ) : null}
                </Collapsible>
              );
            })}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EngagementTimeline({
  engagement,
  acoustic,
  currentFrame = 0,
  onSeek,
  className,
}: EngagementTimelineProps) {
  const [showAcoustic, setShowAcoustic] = useState(false);
  const frame = Math.max(0, Math.min(engagement.n_trs - 1, currentFrame));
  const salienceSet = new Set(engagement.derived.salience_events.trs);
  const dominantColor =
    ENGAGEMENT_COLORS[engagement.derived.dominant_network_tr[frame]] ??
    "var(--foreground)";

  return (
    <Card className={className}>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Network engagement</CardTitle>
          <CardDescription>{engagement.disclaimer}</CardDescription>
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
              {engagement.networks[engagement.derived.dominant_network_tr[frame]]
                ?.headline ?? "—"}
            </span>
          </div>
          {acoustic ? (
            <Toggle
              size="sm"
              pressed={showAcoustic}
              onPressedChange={setShowAcoustic}
              aria-label="Toggle acoustic overlay"
              className="text-xs"
            >
              Acoustic overlay
            </Toggle>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAcoustic && acoustic ? (
          <div className="engagement-acoustic-legend">
            {acoustic.feature_order.map((key) => {
              const feat = acoustic.features[key];
              if (!feat) return null;
              return (
                <span
                  key={key}
                  className="engagement-acoustic-legend__item"
                  style={{ color: ACOUSTIC_OVERLAY_COLORS[key] }}
                >
                  {feat.label}
                </span>
              );
            })}
            <span className="engagement-acoustic-legend__hint">
              {acoustic.disclaimer}
            </span>
          </div>
        ) : null}

        <div className="engagement-rows">
          {ENGAGEMENT_NETWORK_ORDER.map((net) => {
            const trace = engagement.networks[net];
            if (!trace) return null;
            return (
              <NetworkRow
                key={net}
                net={net}
                trace={trace}
                engagement={engagement}
                acoustic={acoustic}
                showAcoustic={showAcoustic}
                nTrs={engagement.n_trs}
                color={ENGAGEMENT_COLORS[net] ?? "var(--primary)"}
                dominantNetworkTr={engagement.derived.dominant_network_tr}
                currentFrame={frame}
                onSeek={onSeek}
              />
            );
          })}
        </div>

        {engagement.derived.salience_events.trs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Surprise events (Δz ≥{" "}
            {engagement.derived.salience_events.threshold_z_derivative}):{" "}
            {engagement.derived.salience_events.trs
              .map((t) => `${t}s`)
              .join(", ")}
            {salienceSet.has(frame) ? " · at playhead" : ""}
          </p>
        )}

        <DominantSegmentTimeline
          engagement={engagement}
          currentFrame={frame}
          onSeek={onSeek}
        />

        <EngagementSummaries engagement={engagement} />
      </CardContent>
    </Card>
  );
}
