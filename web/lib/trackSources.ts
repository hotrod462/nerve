export type TrackYouTubeSource = {
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
};

export type TrackPersonalSource = {
  createdBy: string;
  note?: string;
};

export type TrackSource = TrackYouTubeSource | TrackPersonalSource;

export function isYouTubeSource(
  source: TrackSource
): source is TrackYouTubeSource {
  return "youtubeUrl" in source;
}

/** Curated YouTube metadata for gallery rows (oEmbed + official uploads). */
export const TRACK_SOURCES: Record<string, TrackSource> = {
  avicii_wake_me_up: {
    youtubeId: "IcrbM1l_BoI",
    youtubeUrl: "https://www.youtube.com/watch?v=IcrbM1l_BoI",
    title: "Avicii - Wake Me Up (Official Video)",
    channel: "AviciiOfficialVEVO",
    thumbnailUrl: "https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg",
  },
  back_to_truth_darius_syrossian: {
    youtubeId: "3SeZB3MnzXQ",
    youtubeUrl: "https://www.youtube.com/watch?v=3SeZB3MnzXQ",
    title: "Darius Syrossian - Back To Truth (Nick Curly Remix)",
    channel: "Definition:Music",
    thumbnailUrl: "https://i.ytimg.com/vi/3SeZB3MnzXQ/hqdefault.jpg",
  },
  beethoven_fur_elise: {
    youtubeId: "wfF0zHeU3Zs",
    youtubeUrl: "https://www.youtube.com/watch?v=wfF0zHeU3Zs",
    title: "Beethoven - Für Elise",
    channel: "Rousseau",
    thumbnailUrl: "https://i.ytimg.com/vi/wfF0zHeU3Zs/hqdefault.jpg",
  },
  beethoven_moonlight_sonata: {
    youtubeId: "BV7RkEL6oRc",
    youtubeUrl: "https://www.youtube.com/watch?v=BV7RkEL6oRc",
    title: "Beethoven - Moonlight Sonata (3rd Movement)",
    channel: "Rousseau",
    thumbnailUrl: "https://i.ytimg.com/vi/BV7RkEL6oRc/hqdefault.jpg",
  },
  blue_space_jody_wisternoff: {
    youtubeId: "Csd230IN3Cs",
    youtubeUrl: "https://www.youtube.com/watch?v=Csd230IN3Cs",
    title:
      "Jody Wisternoff & James Grant feat. Jinadu - Blue Space (Official Lyric Video)",
    channel: "Anjunadeep",
    thumbnailUrl: "https://i.ytimg.com/vi/Csd230IN3Cs/hqdefault.jpg",
  },
  drifting_tiesto: {
    youtubeId: "imAklKjAQDc",
    youtubeUrl: "https://www.youtube.com/watch?v=imAklKjAQDc",
    title: "Tiësto - Drifting (Official Music Video)",
    channel: "Tiësto",
    thumbnailUrl: "https://i.ytimg.com/vi/imAklKjAQDc/hqdefault.jpg",
  },
  eminem_rap_god: {
    youtubeId: "XbGs_qK2PQA",
    youtubeUrl: "https://www.youtube.com/watch?v=XbGs_qK2PQA",
    title: "Eminem - Rap God (Explicit)",
    channel: "EminemVEVO",
    thumbnailUrl: "https://i.ytimg.com/vi/XbGs_qK2PQA/hqdefault.jpg",
  },
  escape_john_summit: {
    youtubeId: "P6LSIBpCzrc",
    youtubeUrl: "https://www.youtube.com/watch?v=P6LSIBpCzrc",
    title: "Kx5 - Escape (John Summit Remix) [Extended Mix]",
    channel: "John Summit",
    thumbnailUrl: "https://i.ytimg.com/vi/P6LSIBpCzrc/hqdefault.jpg",
  },
  fell_in_luv_carlita: {
    youtubeId: "JBVDVj0RPqI",
    youtubeUrl: "https://www.youtube.com/watch?v=JBVDVj0RPqI",
    title: "Carlita & Calussa - Fell In Luv (Official Full Stream)",
    channel: "Higher Ground",
    thumbnailUrl: "https://i.ytimg.com/vi/JBVDVj0RPqI/hqdefault.jpg",
  },
  its_in_your_eyes_diode: {
    youtubeId: "SqvQ1NgqMp4",
    youtubeUrl: "https://www.youtube.com/watch?v=SqvQ1NgqMp4",
    title: "It's in Your Eyes (Diode Eins Remix)",
    channel: "Disappeared Completely",
    thumbnailUrl: "https://i.ytimg.com/vi/SqvQ1NgqMp4/hqdefault.jpg",
  },
  la_noche_chris_lake: {
    youtubeId: "Y2AkWTF-NVU",
    youtubeUrl: "https://www.youtube.com/watch?v=Y2AkWTF-NVU",
    title: "Chris Lake, Skrillex & Anita B Queen - La Noche (Official)",
    channel: "Chris Lake",
    thumbnailUrl: "https://i.ytimg.com/vi/Y2AkWTF-NVU/hqdefault.jpg",
  },
  let_it_happen_omnom: {
    youtubeId: "7fg12RzVGRo",
    youtubeUrl: "https://www.youtube.com/watch?v=7fg12RzVGRo",
    title: "Tame Impala - Let It Happen (OMNOM Remix)",
    channel: "OMNOM Music",
    thumbnailUrl: "https://i.ytimg.com/vi/7fg12RzVGRo/hqdefault.jpg",
  },
  martin_garrix_animals: {
    youtubeId: "gCYcHz2k5x0",
    youtubeUrl: "https://www.youtube.com/watch?v=gCYcHz2k5x0",
    title: "Martin Garrix - Animals (Official Video)",
    channel: "STMPD RCRDS",
    thumbnailUrl: "https://i.ytimg.com/vi/gCYcHz2k5x0/hqdefault.jpg",
  },
  mrs_negi_remix_v2: {
    createdBy: "Aryan Jain",
    note: "Personal remix — no official YouTube release",
  },
  paris_chainsmokers: {
    youtubeId: "fRNkQH4DVg8",
    youtubeUrl: "https://www.youtube.com/watch?v=fRNkQH4DVg8",
    title: "The Chainsmokers - Paris (Official Video)",
    channel: "ChainsmokersVEVO",
    thumbnailUrl: "https://i.ytimg.com/vi/fRNkQH4DVg8/hqdefault.jpg",
  },
  succession_main_theme: {
    youtubeId: "LlgWqcHXD8w",
    youtubeUrl: "https://www.youtube.com/watch?v=LlgWqcHXD8w",
    title:
      "Succession (Main Title Theme) - Nicholas Britell | Succession (HBO Original Series Soundtrack)",
    channel: "Milan Records USA",
    thumbnailUrl: "https://i.ytimg.com/vi/LlgWqcHXD8w/hqdefault.jpg",
  },
  sunflower_post_malone: {
    youtubeId: "ApXoWvfEYVU",
    youtubeUrl: "https://www.youtube.com/watch?v=ApXoWvfEYVU",
    title:
      "Post Malone, Swae Lee - Sunflower (Spider-Man: Into the Spider-Verse)",
    channel: "PostMaloneVEVO",
    thumbnailUrl: "https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg",
  },
};

export function getTrackSource(runId: string): TrackSource | undefined {
  return TRACK_SOURCES[runId];
}
