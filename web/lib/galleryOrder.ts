/** Featured tracks first; everything else follows alphabetically by run id. */
const GALLERY_PRIORITY = [
  "mrs_negi_remix_v2",
  "sunflower_post_malone",
  "avicii_wake_me_up",
  "beethoven_fur_elise",
  "beethoven_moonlight_sonata",
  "eminem_rap_god",
  "drifting_tiesto",
  "martin_garrix_animals",
  "paris_chainsmokers",
] as const;

const priorityRank = new Map<string, number>(
  GALLERY_PRIORITY.map((id, index) => [id, index])
);

export function sortGalleryRuns<T extends { id: string }>(runs: T[]): T[] {
  return [...runs].sort((a, b) => {
    const rankA = priorityRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rankB = priorityRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });
}
