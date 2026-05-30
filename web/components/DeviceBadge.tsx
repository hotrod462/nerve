export function DeviceBadge({
  resolved,
  deviceOk,
}: {
  resolved?: string;
  deviceOk?: boolean;
}) {
  if (!resolved) return null;
  const ok = deviceOk !== false;
  return (
    <span
      style={{
        fontSize: "0.85rem",
        padding: "0.2rem 0.5rem",
        borderRadius: 4,
        background: ok ? "#1e3a2f" : "#3a2a1e",
        color: ok ? "#8fd4a8" : "#f0c080",
      }}
    >
      device: {resolved}
      {!ok && " (audit warning)"}
    </span>
  );
}
