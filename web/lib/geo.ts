import type { Metadata } from "next";

/** Public site origin for OG URLs, sitemap, JSON-LD. Set in web/.env.local */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const SITE_NAME = "Nerve";
export const SITE_TAGLINE =
  "Audio → predicted brain engagement (TRIBE v2 interpretability)";

export const SITE_DESCRIPTION =
  "Nerve turns audio into in-silico cortical and subcortical engagement timelines and a synced 3D Niivue brain viewer. Built on Meta TRIBE v2 — exploratory group-average BOLD simulation, not real MRI.";

export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQ for JSON-LD and visible gallery section — GEO-friendly Q&A. */
export const SITE_FAQ: FaqItem[] = [
  {
    question: "What is Nerve?",
    answer:
      "Nerve is an open-source tool that runs TRIBE v2 on audio and exports predicted cortical (20,484 fsaverage5 vertices) and subcortical engagement traces at 1 Hz, plus a Next.js gallery with a Niivue 3D brain viewer synced to playback.",
  },
  {
    question: "Is Nerve output from a real MRI scanner?",
    answer:
      "No. Nerve produces in-silico group-average BOLD predictions from a deep learning model trained on naturalistic media. Results are exploratory and not suitable for clinical or individual diagnosis.",
  },
  {
    question: "What cortical metrics does the web app show?",
    answer:
      "Seven Yeo network traces with plain headlines: Focus (Control), Surprise (Salience), Tracking (Dorsal attention), Resonance (Default mode), Feeling (Limbic), Pulse (Somatomotor), and Imagery (Visual). Each is z-scored within the clip.",
  },
  {
    question: "What subcortical regions does Nerve track?",
    answer:
      "Harvard-Oxford ROIs: Accumbens (Reward), Caudate (Anticipation), Putamen (Groove), Pallidum (Integration), Amygdala (Arousal), Hippocampus (Memory), and Thalamus (Relay).",
  },
  {
    question: "How do I run Nerve on my own audio?",
    answer:
      "Install with uv, run nerve predict --audio your.wav --out data/outputs/runs/your_id/, then nerve export-web --run that directory. Start the web app to browse /tracks/your_id.",
  },
  {
    question: "What can Nerve be used for?",
    answer:
      "Exploratory workflows: comparing clip edits, auditing podcast or ad pacing, music catalog similarity, genre contrasts, and teaching neuroimaging concepts. It is not a validated virality or emotion classifier.",
  },
];

export function siteMetadata(overrides?: Partial<Metadata>): Metadata {
  const titleDefault = `${SITE_NAME} — ${SITE_TAGLINE}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: titleDefault,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
      "Nerve",
      "TRIBE v2",
      "fMRI simulation",
      "BOLD prediction",
      "music neuroscience",
      "Yeo networks",
      "Niivue",
      "brain viewer",
      "subcortical",
      "generative engine optimization",
      "audio brain mapping",
    ],
    authors: [{ name: "Nerve contributors" }],
    creator: "Nerve",
    openGraph: {
      type: "website",
      locale: "en_US",
      url: SITE_URL,
      siteName: SITE_NAME,
      title: titleDefault,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: titleDefault,
      description: SITE_DESCRIPTION,
    },
    alternates: {
      types: {
        "text/markdown": `${SITE_URL}/llms.txt`,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    ...overrides,
  };
}

export function faqJsonLd(faq: FaqItem[] = SITE_FAQ) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "ScientificApplication",
    operatingSystem: "macOS, Linux, Windows",
    description: SITE_DESCRIPTION,
    softwareVersion: "0.1.0",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "TRIBE v2 cortical audio-only inference",
      "TRIBE subcortical ROI prediction",
      "Schaefer parcellation and Yeo network engagement",
      "GIfTI web bundle export",
      "Niivue 3D brain viewer",
    ],
    citation: [
      "https://github.com/facebookresearch/tribev2",
      "https://arxiv.org/abs/2311.09735",
    ],
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/tracks/{search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function trackPageMetadata(
  trackId: string,
  opts?: { genre?: string; durationTr?: number }
): Metadata {
  const title = `${trackId} — predicted brain engagement`;
  const genrePart = opts?.genre ? ` (${opts.genre})` : "";
  const durationPart =
    opts?.durationTr != null ? ` ${opts.durationTr}s clip.` : "";
  const description = `In-silico TRIBE v2 BOLD predictions for ${trackId}${genrePart}.${durationPart} Cortical Yeo networks, subcortical ROI timelines, and 3D Niivue viewer synced to audio.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tracks/${encodeURIComponent(trackId)}`,
      type: "article",
    },
  };
}
