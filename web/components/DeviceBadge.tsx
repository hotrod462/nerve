import { Badge } from "@/components/ui/badge";

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
    <Badge variant={ok ? "secondary" : "destructive"}>
      device: {resolved}
      {!ok && " (audit warning)"}
    </Badge>
  );
}
