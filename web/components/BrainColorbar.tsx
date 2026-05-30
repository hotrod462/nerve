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
      : "linear-gradient(to right, #000, #800, #f00, #ff0, #fff)";

  return (
    <div className="brain-colorbar" aria-label={`${label} color scale`}>
      <span className="brain-colorbar__label">{label}</span>
      <div className="brain-colorbar__track" style={{ background: gradient }} />
      <div className="brain-colorbar__ticks">
        <span>{vmin.toFixed(3)}</span>
        <span>{vmax.toFixed(3)}</span>
      </div>
    </div>
  );
}
