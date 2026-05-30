"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StimulusAudioProps {
  src?: string;
  frame: number;
  total: number;
  playing: boolean;
  fps?: number;
  onSeek?: (frame: number) => void;
}

function computePeaks(channel: Float32Array, buckets: number): Float32Array {
  const block = Math.max(1, Math.floor(channel.length / buckets));
  const peaks = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const start = i * block;
    const end = Math.min(channel.length, start + block);
    for (let j = start; j < end; j++) {
      max = Math.max(max, Math.abs(channel[j]));
    }
    peaks[i] = max;
  }
  return peaks;
}

export function StimulusAudio({
  src,
  frame,
  total,
  playing,
  onSeek,
}: StimulusAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Decode waveform once per stimulus URL
  useEffect(() => {
    if (!src) {
      setPeaks(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const ac = new AudioContext();

    const closeAudioContext = () => {
      if (ac.state !== "closed") {
        void ac.close().catch(() => undefined);
      }
    };

    async function load() {
      const url = src;
      if (!url) return;
      try {
        setError(null);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const audio = await ac.decodeAudioData(buf.slice(0));
        const merged = new Float32Array(audio.length);
        for (let c = 0; c < audio.numberOfChannels; c++) {
          const ch = audio.getChannelData(c);
          for (let i = 0; i < audio.length; i++) {
            merged[i] += ch[i] / audio.numberOfChannels;
          }
        }
        const next = computePeaks(merged, 1200);
        if (!cancelled) setPeaks(next);
      } catch (e) {
        if (!cancelled) {
          setPeaks(null);
          setError(e instanceof Error ? e.message : "Could not decode audio");
        }
      } finally {
        if (!cancelled) closeAudioContext();
      }
    }

    void load();
    return () => {
      cancelled = true;
      closeAudioContext();
    };
  }, [src]);

  // Keep hidden <audio> in sync with brain timeline
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (Math.abs(el.currentTime - frame) > 0.35) {
      el.currentTime = frame;
    }
  }, [frame, src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing, src]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, wrap.clientWidth);
    const height = 56;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#0c0e13";
    ctx.fillRect(0, 0, width, height);

    const mid = height / 2;
    const maxFrame = Math.max(1, total - 1);
    const playX = (frame / maxFrame) * width;

    if (peaks && peaks.length > 0) {
      const barW = width / peaks.length;
      let maxPeak = 0;
      for (let i = 0; i < peaks.length; i++) maxPeak = Math.max(maxPeak, peaks[i]);
      const scale = maxPeak > 0 ? (height * 0.42) / maxPeak : 1;

      ctx.fillStyle = "#5a6578";
      for (let i = 0; i < peaks.length; i++) {
        const h = peaks[i] * scale;
        const x = i * barW;
        ctx.fillRect(x, mid - h, Math.max(1, barW * 0.85), h * 2);
      }

      // Played portion highlighted (Meta-style progress tint)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playX, height);
      ctx.clip();
      ctx.fillStyle = "#9aa8bc";
      for (let i = 0; i < peaks.length; i++) {
        const h = peaks[i] * scale;
        const x = i * barW;
        ctx.fillRect(x, mid - h, Math.max(1, barW * 0.85), h * 2);
      }
      ctx.restore();
    } else if (error) {
      ctx.fillStyle = "#9aa0a6";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(`Waveform unavailable (${error})`, 8, mid + 4);
    } else {
      ctx.fillStyle = "#9aa0a6";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("Loading waveform…", 8, mid + 4);
    }

    // Playhead
    ctx.strokeStyle = "#7cacf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }, [peaks, frame, total, error]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || total <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.round((x / rect.width) * (total - 1));
    onSeek(Math.max(0, Math.min(total - 1, t)));
  };

  if (!src) return null;

  return (
    <div className="stimulus-audio">
      <div className="stimulus-audio__label">Stimulus audio</div>
      <div ref={wrapRef} className="stimulus-audio__wave-wrap">
        <canvas
          ref={canvasRef}
          className="stimulus-audio__wave"
          onClick={handleClick}
          role="slider"
          aria-label="Audio waveform timeline"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, total - 1)}
          aria-valuenow={frame}
        />
      </div>
      <audio ref={audioRef} src={src} preload="auto" className="stimulus-audio__hidden" />
    </div>
  );
}
