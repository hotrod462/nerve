# Generative Engine Optimization (GEO)

Nerve implements [Generative Engine Optimization](https://arxiv.org/abs/2311.09735) — making the project easy for AI search (ChatGPT, Perplexity, Claude, Gemini) and coding agents to **find, cite, and summarize accurately**.

GEO differs from classic SEO: generative engines synthesize answers from multiple sources, so visibility depends on **clear structure, authoritative facts, statistics, citations, and machine-readable indexes** — not keyword stuffing.

## What we publish

| Asset | Location | Purpose |
|-------|----------|---------|
| `llms.txt` | Repo root + `web/public/llms.txt` | [llms.txt spec](https://llmstxt.org/) index for LLM context |
| `docs/AI.md` | Markdown facts + FAQ | Full structured context for agents |
| `AGENTS.md` | Repo root | Cursor/Copilot agent onboarding |
| JSON-LD | `web/app/layout.tsx` | `SoftwareApplication`, `WebSite`, `FAQPage` schema.org |
| `sitemap.xml` | `web/app/sitemap.ts` | Dynamic URLs including exported tracks |
| `robots.txt` | `web/app/robots.ts` | Crawler policy + sitemap link |
| Rich metadata | Next.js `metadata` API | Title, description, Open Graph, Twitter cards |

## GEO tactics used (from KDD 2024 paper)

1. **Authoritative tone** — plain definitions in README and `docs/AI.md`
2. **Statistics** — vertex counts, TR rate, network/ROI counts in prose
3. **Citations** — TRIBE, Schaefer, Yeo, Harvard-Oxford, GEO paper linked
4. **Structured sections** — FAQ, tables, CLI reference
5. **Fluency / clarity** — “In plain English” README section
6. **Technical terms** — Yeo, BOLD, fsaverage5, TR defined on first use

We do **not** keyword-stuff or add misleading claims about clinical validity.

## Backend / PyPI GEO

Python packages are cited by agents from GitHub, PyPI, and local `llms.txt`:

- `pyproject.toml` keywords, classifiers, and project URLs
- `llms.txt` included in sdist via Hatch
- Module docstrings in `src/nerve/__init__.py` and `cli.py`
- `docs/AI.md` as the canonical fact sheet

## Web GEO

Set `NEXT_PUBLIC_SITE_URL` in `web/.env.local` to your deployed origin (e.g. `https://nerve.example.com`) so Open Graph URLs and sitemaps resolve correctly.

## Maintaining GEO

When adding features:

1. Update `docs/AI.md` FAQ and statistics
2. Add a line to root `llms.txt` and `web/public/llms.txt`
3. Extend `web/lib/geo.ts` FAQ entries if user-facing
4. Re-export tracks so sitemap includes new `/tracks/{id}` URLs
