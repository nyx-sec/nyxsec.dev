# nyxsec.dev

Static site for [nyxsec.dev](https://nyxsec.dev), the public site for Nyx Scanner and Nyx Agent.

The repo is plain HTML, CSS, static assets, and a small docs build pipeline. The root pages are edited by hand. Product docs are copied from the scanner and agent source repos, rendered into `docs/`, and checked in with the site.

## What lives here

- `index.html`: product chooser for Nyx Scanner and Nyx Agent.
- `scanner.html`: Nyx Scanner product page.
- `agent.html`: Nyx Agent product page.
- `news/`: release notes, announcement pages, and the RSS feed.
- `docs/`: generated documentation for both products, plus the Pagefind search index.
- `assets/`: logos, product media, screenshots, and news artwork.
- `styles.css`: shared site styles.
- `tools/sync-docs.sh`: copies markdown docs from the product repos into `docs-src/`.
- `tools/build-docs.js`: renders `docs-src/` into the published `docs/` tree.
- `_headers` and `_redirects`: Cloudflare Pages headers and redirects.
- `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `humans.txt`, and `manifest.json`: crawler, metadata, and install metadata files.

## Local preview

Serve the repository root:

```sh
python3 -m http.server 8788
```

Open `http://localhost:8788`.

No build step is needed for the hand-authored pages. The checked-in `docs/` directory is already publishable.

## Install tooling

The Node dependencies are only needed when rebuilding docs or running format checks.

```sh
npm install
```

Available scripts:

```sh
npm run docs:sync       # copy source markdown into docs-src/
npm run docs:build      # render docs-src/ into docs/
npm run docs            # sync, then build
npm run format          # format root HTML, news HTML, and CSS
npm run format:check    # check formatting without writing
```

## Documentation build

Product docs do not originate in this repo.

- Nyx Scanner docs default source: `/Users/elipeter/nyx/docs/`
- Nyx Agent docs default source: `/Users/elipeter/nyctos/docs/`
- Synced markdown target: `docs-src/`, which is gitignored
- Published output: `docs/`, which is committed

To rebuild docs from the default local source repos:

```sh
npm run docs
```

To use different source paths:

```sh
NYX_REPO=/path/to/nyx NYX_AGENT_REPO=/path/to/nyx-agent npm run docs
```

The build reads each product's `SUMMARY.md` for navigation, resolves mdbook-style include directives, rewrites markdown links to extensionless public URLs, generates heading anchors and prev/next links, copies docs assets, writes product index pages, and runs Pagefind for docs search.

Edit product documentation in the product repos first, then run `npm run docs` here. Direct edits under `docs/` will be overwritten the next time docs are rebuilt.

## Deployment

The site is designed to publish the repository root as static files.

Cloudflare Pages settings:

- Build command: none
- Build output directory: `/`
- Root directory: repository root

The same files can also be served by GitHub Pages, Vercel, Netlify, or any static file host. Cloudflare-specific behavior lives in `_headers` and `_redirects`.

## Source links

- Site: `https://nyxsec.dev`
- Scanner GitHub: `https://github.com/elicpeter/nyx`
- Agent GitHub: `https://github.com/nyx-sec/nyx-agent`
- Scanner docs: `https://nyxsec.dev/docs/nyx/`
- Agent docs: `https://nyxsec.dev/docs/agent/`
- Scanner crate: `https://crates.io/crates/nyx-scanner`
- Scanner Rustdocs: `https://docs.rs/nyx-scanner/latest/nyx_scanner/`

## Maintenance notes

- Keep canonical URLs on `nyxsec.dev`.
- Keep generated docs and Pagefind output together in commits.
- Update `sitemap.xml`, `llms.txt`, `llms-full.txt`, and `news/feed.xml` when adding public pages.
- Keep product facts in sync across root pages, docs metadata, structured data, and release notes.
- Do not commit `docs-src/` or `node_modules/`.
