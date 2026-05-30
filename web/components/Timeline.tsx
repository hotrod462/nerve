"use client";

export function Timeline({
  frame,
  total,
  playing,
  onFrame,
  onPlaying,
}: {
  frame: number;
  total: number;
  playing: boolean;
  onFrame: (f: number) => void;
  onPlaying: (p: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
      <button type="button" onClick={() => onPlaying(!playing)}>
        {playing ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={frame}
        onChange={(e) => onFrame(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ fontSize: "0.85rem", color: "#9aa0a6" }}>
        t={frame}s / {Math.max(0, total - 1)}s
      </span>
    </div>
  );
}
