import type { MeshBundle } from "@/components/BrainViewer";
import { runWebUrl } from "@/lib/assets";
import type { MeshManifest } from "@/lib/loadRun";

function bundleUrl(runId: string, rel: string): string {
  return runWebUrl(runId, rel);
}

export function buildMeshBundle(
  runId: string,
  mesh?: MeshManifest
): MeshBundle | undefined {
  if (!mesh?.activations) return undefined;

  const url = (rel: string) => bundleUrl(runId, rel);

  const surfaces = mesh.surfaces
    ? (Object.fromEntries(
        (["pial", "half", "inflated"] as const)
          .filter((k) => mesh.surfaces?.[k])
          .map((k) => [
            k,
            {
              lh: url(mesh.surfaces![k]!.lh),
              rh: url(mesh.surfaces![k]!.rh),
            },
          ])
      ) as MeshBundle["surfaces"])
    : undefined;

  return {
    surfaces,
    activations: {
      lh: url(mesh.activations.lh),
      rh: url(mesh.activations.rh),
    },
    sulc: mesh.sulc
      ? {
          lh: url(mesh.sulc.lh),
          rh: url(mesh.sulc.rh),
        }
      : undefined,
    sulcRange: mesh.sulc_range,
    atlas: mesh.atlas
      ? {
          parcels: mesh.atlas.parcels
            ? {
                lh: url(mesh.atlas.parcels.lh),
                rh: url(mesh.atlas.parcels.rh),
              }
            : undefined,
          yeo: mesh.atlas.yeo
            ? {
                lh: url(mesh.atlas.yeo.lh),
                rh: url(mesh.atlas.yeo.rh),
              }
            : undefined,
          lut: mesh.atlas.lut ? url(mesh.atlas.lut) : undefined,
          borders: mesh.atlas.borders
            ? {
                yeo: mesh.atlas.borders.yeo
                  ? {
                      lh: url(mesh.atlas.borders.yeo.lh),
                      rh: url(mesh.atlas.borders.yeo.rh),
                    }
                  : undefined,
                parcels: mesh.atlas.borders.parcels
                  ? {
                      lh: url(mesh.atlas.borders.parcels.lh),
                      rh: url(mesh.atlas.borders.parcels.rh),
                    }
                  : undefined,
              }
            : undefined,
          region_labels: mesh.atlas.region_labels
            ? {
                lh: url(mesh.atlas.region_labels.lh),
                rh: url(mesh.atlas.region_labels.rh),
              }
            : undefined,
        }
      : undefined,
    subcortical: mesh.subcortical
      ? {
          rois: mesh.subcortical.rois.map((roi) => ({
            id: roi.id,
            geometry: url(roi.geometry),
            activations: url(roi.activations),
          })),
          vmin: mesh.subcortical.vmin,
          vmax: mesh.subcortical.vmax,
        }
      : undefined,
  };
}
