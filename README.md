# Nyx landing page

Static landing page for [nyxscan.dev](https://nyxscan.dev).

This repo is intentionally small: plain HTML, CSS, and static assets. The only build step is the docs generator, which renders markdown from the Nyx source repo into `/docs/` using the site's editorial theme. Everything else is hand-authored. Cloudflare Pages, GitHub Pages, Vercel, and Netlify can serve the root directory directly.

## Local preview

From this directory:

```sh
python3 -m http.server 8788
```

Then open `http://localhost:8788`.

## Docs

Markdown lives in the Nyx source repo at `/Users/elipeter/nyx/docs/`. To regenerate `/docs/` here:

```sh
npm install
npm run docs        # = docs:sync + docs:build
```

- `npm run docs:sync` copies `*.md`, `detectors/*.md`, `CHANGELOG.md`, and `ROADMAP.md` from the Nyx repo into `docs-src/` (gitignored). Set `NYX_REPO=/path/to/nyx` to override the source location.
- `npm run docs:build` walks `docs-src/`, renders each markdown file through `marked` with the site's editorial theme, parses `SUMMARY.md` for the sidebar, and writes HTML into `/docs/`.

The build script (`tools/build-docs.js`) handles mdbook-style `{{#include ../FILE.md}}` directives, rewrites `.md` links to `.html`, generates heading anchors, emits prev/next page navigation, and runs Pagefind to build the docs search index.

The Nyx repo stays the single source of truth — edit markdown there, then re-run `npm run docs` here.

## Cloudflare Pages

- Build command: none
- Build output directory: `/`
- Root directory: repository root

The site includes `robots.txt`, `sitemap.xml`, `llms.txt`, `humans.txt`, Open Graph/Twitter metadata, and JSON-LD structured data.

## Source facts

Project links and copy were taken from the Nyx source repository at `/Users/elipeter/nyx`:

- GitHub: `https://github.com/elicpeter/nyx`
- Docs: `https://nyxscan.dev/docs/` (built from `/Users/elipeter/nyx/docs/`)
- Rustdocs: `https://docs.rs/nyx-scanner/latest/nyx_scanner/`
- Crate: `https://crates.io/crates/nyx-scanner`
- License: `GPL-3.0-or-later`
- Sponsor metadata: `github: elicpeter`
