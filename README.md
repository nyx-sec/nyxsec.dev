# Nyx landing page

Static landing page for [nyxscan.dev](https://nyxscan.dev).

This repo is intentionally small: plain HTML, CSS, and static assets. There is no framework, package manager, or build step. Cloudflare Pages, GitHub Pages, Vercel, and Netlify can serve the root directory directly.

## Local preview

From this directory:

```sh
python3 -m http.server 8788
```

Then open `http://localhost:8788`.

## Cloudflare Pages

- Build command: none
- Build output directory: `/`
- Root directory: repository root

The site includes `robots.txt`, `sitemap.xml`, `llms.txt`, `humans.txt`, Open Graph/Twitter metadata, and JSON-LD structured data.

## Source facts

Project links and copy were taken from the Nyx source repository at `/Users/elipeter/nyx`:

- GitHub: `https://github.com/elicpeter/nyx`
- Docs: `https://elicpeter.github.io/nyx/`
- Rustdocs: `https://docs.rs/nyx-scanner/latest/nyx_scanner/`
- Crate: `https://crates.io/crates/nyx-scanner`
- License: `GPL-3.0-or-later`
- Sponsor metadata: `github: elicpeter`
