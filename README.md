# Nyx landing page

Static landing page for [nyxscan.dev](https://nyxscan.dev).

This repo is intentionally small: plain HTML, CSS, and static assets. The only build step is the docs generator, which renders markdown from the Nyx and Nyx Agent source repos into `/docs/` using the site's editorial theme. Everything else is hand-authored. Cloudflare Pages, GitHub Pages, Vercel, and Netlify can serve the root directory directly.

## Local preview

From this directory:

```sh
python3 -m http.server 8788
```

Then open `http://localhost:8788`.

## Docs

Markdown lives in the Nyx source repo at `/Users/elipeter/nyx/docs/` and the Nyx Agent source repo at `/Users/elipeter/nyctos/docs/`. To regenerate `/docs/` here:

```sh
npm install
npm run docs        # = docs:sync + docs:build
```

- `npm run docs:sync` copies scanner docs into `docs-src/nyx/` and agent docs into `docs-src/agent/` (gitignored). Set `NYX_REPO=/path/to/nyx` or `NYX_AGENT_REPO=/path/to/nyx-agent` to override the source locations.
- `npm run docs:build` renders `/docs/` as a chooser, `/docs/nyx/` as the scanner docs, and `/docs/agent/` as the agent docs. It parses each `SUMMARY.md` for the sidebar and writes the generated HTML into `/docs/`.

The build script (`tools/build-docs.js`) handles mdbook-style `{{#include ../FILE.md}}` directives, rewrites `.md` links to `.html`, generates heading anchors, emits prev/next page navigation, and runs Pagefind to build the docs search index.

The source repos stay the single source of truth — edit markdown there, then re-run `npm run docs` here.

## Cloudflare Pages

- Build command: none
- Build output directory: `/`
- Root directory: repository root

The site includes `robots.txt`, `sitemap.xml`, `llms.txt`, `humans.txt`, Open Graph/Twitter metadata, and JSON-LD structured data.

## Source facts

Project links and copy were taken from the Nyx source repository at `/Users/elipeter/nyx`:

- GitHub: `https://github.com/elicpeter/nyx`
- Scanner docs: `https://nyxscan.dev/docs/nyx/` (built from `/Users/elipeter/nyx/docs/`)
- Agent docs: `https://nyxscan.dev/docs/agent/` (built from `/Users/elipeter/nyctos/docs/`)
- Rustdocs: `https://docs.rs/nyx-scanner/latest/nyx_scanner/`
- Crate: `https://crates.io/crates/nyx-scanner`
- License: `GPL-3.0-or-later`
- Sponsor metadata: `github: elicpeter`
