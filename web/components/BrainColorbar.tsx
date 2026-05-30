"use client";

export function BrainColorbar({
  colormap = "hot",
  vmin,
  vmax,
  label = "Predicted BOLD",
}: {
  colormap?: string;
  vmin?: number;
  vmax?: number;
  label?: string;
}) {
  if (vmin === undefined || vmax === undefined) return null;

  const gradient =
    colormap === "cold_hot"
      ? "linear-gradient(to right, #2166ac, #f7f7f7, #b2182b)"
      : colormap === "redyell"
        ? "linear-gradient(to right, #200, #c00, #f80, #fc0)"
        : "linear-gradient(to right, #000, #800, #f00, #ff0, #fff)";

  return (
    <div className="min-w-40" aria-label={`${label} color scale`}>
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <div
        className="h-2.5 rounded border border-border"
        style={{ background: gradient }}
      />
      <div className="mt-0.5 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>{vmin.toFixed(3)}</span>
        <span>{vmax.toFixed(3)}</span>
      </div>
    </div>
  );
}
