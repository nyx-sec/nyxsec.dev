#!/usr/bin/env node
/* eslint-disable no-console */
// Build nyxscan.dev/docs/ from markdown in docs-src/.
// Source of truth lives in /Users/elipeter/nyx/docs (see tools/sync-docs.sh).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { marked } = require("marked");
const hljs = require("highlight.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "docs-src");
const OUT = path.join(ROOT, "docs");
const SITE_URL = "https://nyxscan.dev";

const SITE_DESC =
  "Documentation for Nyx, the open-source, local-first SAST scanner written in Rust. Quickstart, CLI reference, detectors, configuration, and language coverage.";

// ─────────────────────────────────────────
// Marked config — highlight via highlight.js
// ─────────────────────────────────────────
marked.setOptions({
  gfm: true,
  breaks: false,
});

const renderer = new marked.Renderer();

renderer.code = function ({ text, lang }) {
  const langClean = (lang || "").trim().split(/\s+/)[0];
  let html;
  if (langClean && hljs.getLanguage(langClean)) {
    html = hljs.highlight(text, { language: langClean, ignoreIllegals: true }).value;
  } else {
    html = hljs.highlightAuto(text).value;
  }
  return `<pre><code class="hljs language-${langClean || "plain"}">${html}</code></pre>\n`;
};

// Heading slugs + anchor links.
const seenSlugs = new Map();
function resetSlugs() {
  seenSlugs.clear();
}
function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const n = (seenSlugs.get(base) || 0) + 1;
  seenSlugs.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}
renderer.heading = function ({ tokens, depth }) {
  const inner = this.parser.parseInline(tokens);
  const id = slugify(inner);
  return `<h${depth} id="${id}"><a class="docs-anchor" href="#${id}" aria-label="Link to ${id}" data-pagefind-ignore>#</a>${inner}</h${depth}>\n`;
};

// Rewrite *.md / *.MD links → *.html so cross-page links work after build.
renderer.link = function ({ href, title, tokens }) {
  let h = href || "";
  if (h && !/^[a-z]+:/i.test(h) && !h.startsWith("#") && !h.startsWith("//")) {
    h = h.replace(/\.md(?=$|[#?])/i, ".html");
    // Mdbook stub stripped CHANGELOG.md / ROADMAP.md → those map to lowercase pages.
    h = h.replace(/(^|[\/])CHANGELOG\.html/, "$1changelog.html");
    h = h.replace(/(^|[\/])ROADMAP\.html/, "$1roadmap.html");
  }
  const inner = this.parser.parseInline(tokens);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${h}"${titleAttr}>${inner}</a>`;
};

// ─────────────────────────────────────────
// Include resolver — mdbook {{#include path}}
// ─────────────────────────────────────────
function resolveIncludes(md, filePath) {
  return md.replace(/\{\{\s*#include\s+([^}\s]+)\s*\}\}/g, (_, inc) => {
    // Try relative to the file first, then docs-src root by basename.
    const candidates = [path.resolve(path.dirname(filePath), inc), path.join(SRC, path.basename(inc))];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        let inner = fs.readFileSync(c, "utf8");
        // Strip a leading top-level H1 — page already provides one via title.
        inner = inner.replace(/^#\s+[^\n]+\n+/, "");
        return inner;
      }
    }
    console.warn(`warn: include not resolved: ${inc} (from ${filePath})`);
    return "";
  });
}

// ─────────────────────────────────────────
// SUMMARY.md → sidebar tree
// ─────────────────────────────────────────
function parseSummary(md) {
  const sections = [];
  let current = null;
  const lines = md.split("\n");
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const heading = /^#\s+(.+)$/.exec(line);
    if (heading) {
      // Skip the doc's own H1 ("Summary").
      if (/^summary$/i.test(heading[1].trim())) continue;
      current = { title: heading[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    const item = /^(\s*)-\s*\[([^\]]+)\]\(([^)]+)\)\s*$/.exec(line);
    if (item && current) {
      const indent = item[1].length;
      const node = {
        title: item[2].trim(),
        href: item[3].trim().replace(/\.md(?=$|[#?])/, ".html"),
        children: [],
      };
      if (indent === 0 || current.items.length === 0) {
        current.items.push(node);
      } else {
        const last = current.items[current.items.length - 1];
        last.children.push(node);
      }
    }
  }
  return sections;
}

function flattenNav(sections) {
  const flat = [];
  for (const sec of sections) {
    for (const it of sec.items) {
      flat.push({ title: it.title, href: it.href, section: sec.title });
      for (const c of it.children) flat.push({ title: c.title, href: c.href, section: sec.title, parent: it });
    }
  }
  return flat;
}

function navIndex(flat) {
  const map = new Map();
  for (const n of flat) map.set(n.href, n);
  return map;
}

function deriveKeywords(title, section, body) {
  const base = ["Nyx", "Nyx scanner", "SAST", "static analysis", "Rust security scanner", "local-first SAST"];
  const extra = [];
  if (section) extra.push(section);
  if (title) extra.push(title);
  // Heuristic: pull a few ALL-CAPS tokens or common terms from body.
  const tokens =
    body.match(
      /\b(taint|SARIF|CFG|SSA|SBOM|CVE|RCE|SSRF|XSS|FastAPI|Rust|Python|Go|JavaScript|TypeScript|Java|TOML|JSON)\b/gi,
    ) || [];
  for (const t of tokens) if (!extra.includes(t)) extra.push(t);
  return [...base, ...extra.slice(0, 6)];
}

function pageJsonLd({ title, description, canonical, section, parentHref, parentTitle, isIndex }) {
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE_URL}/docs/` },
    ],
  };
  if (parentHref && parentTitle) {
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 3,
      name: parentTitle,
      item: `${SITE_URL}/docs/${parentHref}`,
    });
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 4,
      name: title,
      item: canonical,
    });
  } else if (!isIndex) {
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 3,
      name: title,
      item: canonical,
    });
  }

  const person = {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: "Eli Peter",
    url: "https://github.com/elicpeter",
    sameAs: ["https://github.com/elicpeter", "https://github.com/sponsors/elicpeter"],
  };

  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: "Nyx",
    description: "Local-first, open-source SAST scanner written in Rust.",
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#person` },
  };

  if (isIndex) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        person,
        website,
        {
          "@type": "TechArticle",
          "@id": `${canonical}#page`,
          headline: title,
          name: title,
          url: canonical,
          description,
          inLanguage: "en",
          isPartOf: { "@id": `${SITE_URL}/#website` },
          publisher: { "@id": `${SITE_URL}/#person` },
          author: { "@id": `${SITE_URL}/#person` },
          image: `${SITE_URL}/og-image.png`,
        },
        { ...breadcrumb, "@id": `${canonical}#breadcrumbs` },
      ],
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      website,
      {
        "@type": "TechArticle",
        "@id": `${canonical}#article`,
        headline: title,
        name: title,
        url: canonical,
        description,
        inLanguage: "en",
        articleSection: section || "Documentation",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#person` },
        author: { "@id": `${SITE_URL}/#person` },
        image: `${SITE_URL}/og-image.png`,
        mainEntityOfPage: canonical,
      },
      { ...breadcrumb, "@id": `${canonical}#breadcrumbs` },
    ],
  };
}

function renderSidebar(sections, currentHref) {
  const norm = (h) => h.replace(/^\.\//, "");
  const isCurrent = (h) => norm(h) === norm(currentHref);
  const depth = currentHref.split("/").length - 1;
  const upPrefix = "../".repeat(depth);
  const rel = (h) => (upPrefix ? upPrefix + h : h);

  const parts = ['<nav class="docs-sidebar" aria-label="Documentation">'];
  parts.push(`<a class="docs-sidebar__brand" href="${rel("")}">Docs</a>`);
  for (const sec of sections) {
    parts.push(`<div class="docs-sidebar__group">`);
    parts.push(`<h2 class="docs-sidebar__heading">${escapeHtml(sec.title)}</h2>`);
    parts.push(`<ul class="docs-sidebar__list">`);
    for (const it of sec.items) {
      const cur = isCurrent(it.href) ? ' aria-current="page"' : "";
      parts.push(`<li><a class="docs-sidebar__link" href="${rel(it.href)}"${cur}>${escapeHtml(it.title)}</a>`);
      if (it.children.length) {
        parts.push(`<ul class="docs-sidebar__sublist">`);
        for (const c of it.children) {
          const ccur = isCurrent(c.href) ? ' aria-current="page"' : "";
          parts.push(
            `<li><a class="docs-sidebar__link docs-sidebar__link--sub" href="${rel(c.href)}"${ccur}>${escapeHtml(c.title)}</a></li>`,
          );
        }
        parts.push(`</ul>`);
      }
      parts.push(`</li>`);
    }
    parts.push(`</ul></div>`);
  }
  parts.push("</nav>");
  return parts.join("");
}

function renderDocsSearch() {
  return `<div class="docs-search docs-search--content" data-docs-search>
    <label class="visually-hidden" for="docs-search-input">Search docs</label>
    <div class="docs-search__control">
      <span class="docs-search__icon" aria-hidden="true"></span>
      <input id="docs-search-input" data-docs-search-input type="search" placeholder="Search docs" autocomplete="off" autocapitalize="none" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="docs-search-results" aria-expanded="false" />
      <kbd class="docs-search__key" aria-hidden="true">⌘K</kbd>
    </div>
    <div class="docs-search__panel" data-docs-search-panel hidden>
      <div class="docs-search__status" data-docs-search-status></div>
      <div class="docs-search__results" id="docs-search-results" data-docs-search-results role="listbox" aria-label="Search results"></div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractFirstHeading(md) {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : null;
}

function stripFirstHeading(md) {
  return md.replace(/^#\s+[^\n]+\n+/, "");
}

function plainSummary(md, max = 200) {
  const stripped = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/^#.*$/gm, "")
    .replace(/^\s*[-*+]\s.*$/gm, "")
    .replace(/^\s*\d+\.\s.*$/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/^[\s|:-]*$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~>]/g, "")
    .trim();
  const paras = stripped
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // Skip leads that end with a colon (set up a code/list); take the next.
  let para = paras.find((p) => p.length > 40 && !p.endsWith(":")) || paras[0] || "";
  if (para.length <= max) return para;
  return (
    para
      .slice(0, max - 1)
      .replace(/\s+\S*$/, "")
      .replace(/[,;:]\s*$/, "") + "…"
  );
}

function pageTemplate({
  title,
  description,
  keywords,
  canonical,
  sidebar,
  prevNext,
  body,
  depthPrefix,
  isIndex,
  jsonLd,
  prevHref,
  nextHref,
}) {
  const p = depthPrefix;
  const fullTitle = isIndex ? `${title} | Nyx — local-first Rust SAST scanner` : `${title} | Nyx docs`;
  const kw =
    keywords && keywords.length ? `\n    <meta name="keywords" content="${escapeHtml(keywords.join(", "))}" />` : "";
  const prevLink = prevHref ? `\n    <link rel="prev" href="${prevHref}" />` : "";
  const nextLink = nextHref ? `\n    <link rel="next" href="${nextHref}" />` : "";
  const ogType = isIndex ? "website" : "article";
  const jsonLdBlock = jsonLd
    ? `\n    <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />${kw}
    <meta name="author" content="Eli Peter" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <link rel="canonical" href="${canonical}" />
    <link rel="sitemap" type="application/xml" href="${SITE_URL}/sitemap.xml" />
    <link rel="alternate" hreflang="en" href="${canonical}" />
    <link rel="alternate" hreflang="x-default" href="${canonical}" />${prevLink}${nextLink}
    <link rel="icon" type="image/png" sizes="32x32" href="${p}favicon-32.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="${p}favicon-64.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="${p}favicon-180.png" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="alternate" type="application/rss+xml" title="Nyx — News &amp; release notes" href="/news/feed.xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${p}styles.css" />
    <script defer src="${p}docs/search.js"></script>

    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Nyx" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE_URL}/og-image.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Nyx — local-first Rust SAST scanner" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.png" />
    <meta name="twitter:image:alt" content="Nyx — local-first Rust SAST scanner" />
    <meta name="theme-color" content="#F9F8F4" />${jsonLdBlock}
  </head>
  <body class="docs-body">
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="site-header" aria-label="Primary navigation">
      <div class="container site-header__inner">
        <a class="brand" href="${p}" aria-label="Nyx home">
          <img src="${p}assets/logo.png" alt="Nyx" class="brand-logo" />
        </a>
        <span class="header-wordmark">NYX</span>
        <nav class="nav" aria-label="Main navigation">
          <a href="${p}news/">News</a>
          <a href="${p}docs/" aria-current="page">Docs</a>
          <a class="nav-github" href="https://github.com/elicpeter/nyx">GitHub</a>
        </nav>
      </div>
    </header>

    <main id="main" class="docs-page">
      <div class="docs-shell">
        ${sidebar}
        <article class="docs-content">
          ${renderDocsSearch()}
          <div class="docs-prose" data-pagefind-body>
${body}
          </div>
          ${prevNext}
        </article>
      </div>
    </main>

    <footer class="site-footer">
      <div class="container site-footer__inner">
        <p class="site-footer__copy">© ${new Date().getFullYear()} Eli Peter · Nyx is licensed under GPL-3.0-or-later.</p>
        <nav class="site-footer__nav" aria-label="Footer">
          <a href="${p}">Home</a>
          <a href="${p}news/">News</a>
          <a href="${p}docs/">Docs</a>
          <a href="https://github.com/elicpeter/nyx">GitHub</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

function renderPrevNext(flat, href) {
  const idx = flat.findIndex((x) => x.href === href);
  if (idx < 0) return "";
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;
  if (!prev && !next) return "";
  const depth = href.split("/").length - 1;
  const upPrefix = "../".repeat(depth);
  const rel = (h) => (upPrefix ? upPrefix + h : h);
  const prevHtml = prev
    ? `<a class="docs-prevnext__link docs-prevnext__link--prev" href="${rel(prev.href)}">
        <span class="docs-prevnext__label">Previous</span>
        <span class="docs-prevnext__title">${escapeHtml(prev.title)}</span>
      </a>`
    : '<span class="docs-prevnext__spacer"></span>';
  const nextHtml = next
    ? `<a class="docs-prevnext__link docs-prevnext__link--next" href="${rel(next.href)}">
        <span class="docs-prevnext__label">Next</span>
        <span class="docs-prevnext__title">${escapeHtml(next.title)}</span>
      </a>`
    : '<span class="docs-prevnext__spacer"></span>';
  return `<nav class="docs-prevnext" aria-label="Page navigation">${prevHtml}${nextHtml}</nav>`;
}

// ─────────────────────────────────────────
// Build
// ─────────────────────────────────────────
function copyAssets() {
  const srcAssets = path.join(SRC, "assets");
  if (!fs.existsSync(srcAssets)) return;
  const dst = path.join(OUT, "assets");
  fs.mkdirSync(dst, { recursive: true });
  copyRecursive(srcAssets, dst);
}

function copySearchScript() {
  const scriptSrc = path.join(ROOT, "docs-search.js");
  if (!fs.existsSync(scriptSrc)) {
    throw new Error("docs-search.js missing");
  }
  fs.copyFileSync(scriptSrc, path.join(OUT, "search.js"));
}

function runPagefind() {
  const bin = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "pagefind.cmd" : "pagefind");
  if (!fs.existsSync(bin)) {
    throw new Error("Pagefind missing — run `npm install` first.");
  }

  execFileSync(
    bin,
    [
      "--site",
      ROOT,
      "--glob",
      "docs/**/*.html",
      "--output-subdir",
      "docs/pagefind",
      "--force-language",
      "en",
      "--include-characters=-_./:#",
      "--quiet",
    ],
    { stdio: "inherit" },
  );
}

function copyRecursive(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, entry.name);
    const t = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(t, { recursive: true });
      copyRecursive(f, t);
    } else {
      fs.copyFileSync(f, t);
    }
  }
}

function walkMd(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "SUMMARY.md") continue;
    if (entry.name === "assets") continue;
    const f = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMd(f, base, acc);
    else if (entry.name.endsWith(".md")) {
      acc.push(path.relative(base, f));
    }
  }
  return acc;
}

function build() {
  if (!fs.existsSync(SRC)) {
    console.error("docs-src/ missing — run `npm run docs:sync` first.");
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const summaryRaw = fs.readFileSync(path.join(SRC, "SUMMARY.md"), "utf8");
  const sections = parseSummary(summaryRaw);
  const flat = flattenNav(sections);
  const navMap = navIndex(flat);

  // Build each markdown page.
  const mdFiles = walkMd(SRC);
  for (const rel of mdFiles) {
    const srcFile = path.join(SRC, rel);
    const outRel = rel.replace(/\.md$/i, ".html");
    const outRelKey = outRel.replace(/\\/g, "/");
    const outFile = path.join(OUT, outRel);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    let md = fs.readFileSync(srcFile, "utf8");
    md = resolveIncludes(md, srcFile);

    const title = extractFirstHeading(md) || path.basename(rel, ".md");
    const description = plainSummary(stripFirstHeading(md)) || SITE_DESC;

    resetSlugs();
    const body = marked.parse(md, { renderer });

    const depth = rel.split(path.sep).length;
    const depthPrefix = "../".repeat(depth);

    const canonical = `${SITE_URL}/docs/${outRelKey}`;
    const sidebar = renderSidebar(sections, outRelKey);
    const prevNext = renderPrevNext(flat, outRelKey);

    const navEntry = navMap.get(outRelKey);
    const section = navEntry ? navEntry.section : null;
    const parentHref = navEntry && navEntry.parent ? navEntry.parent.href : null;
    const parentTitle = navEntry && navEntry.parent ? navEntry.parent.title : null;
    const keywords = deriveKeywords(title, section, md);
    const jsonLd = pageJsonLd({
      title,
      description,
      canonical,
      section,
      parentHref,
      parentTitle,
      isIndex: false,
    });

    const idx = flat.findIndex((x) => x.href === outRelKey);
    const upPrefix = "../".repeat(outRelKey.split("/").length - 1);
    const relPath = (h) => (upPrefix ? upPrefix + h : h);
    const prevHref = idx > 0 ? relPath(flat[idx - 1].href) : null;
    const nextHref = idx >= 0 && idx < flat.length - 1 ? relPath(flat[idx + 1].href) : null;

    const html = pageTemplate({
      title,
      description,
      keywords,
      canonical,
      sidebar,
      prevNext,
      body,
      depthPrefix,
      isIndex: false,
      jsonLd,
      prevHref,
      nextHref,
    });
    fs.writeFileSync(outFile, html);
  }

  // Build docs/index.html — overview + nav of every section.
  writeIndex(sections, flat);

  // Copy referenced assets.
  copyAssets();

  // Emit the custom UI shell and Pagefind's generated search index.
  copySearchScript();
  runPagefind();

  // Warn about broken internal links so upstream markdown gets fixed.
  checkInternalLinks();

  console.log(`Built ${mdFiles.length} docs pages → ${OUT}`);
}

function checkInternalLinks() {
  const htmlFiles = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) htmlFiles.push(p);
    }
  })(OUT);
  let broken = 0;
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, "utf8");
    const dir = path.dirname(f);
    const re = /href="([^"#?]+)(?:[#?][^"]*)?"/g;
    let m;
    while ((m = re.exec(html))) {
      const h = m[1];
      if (/^[a-z]+:/i.test(h) || h.startsWith("//") || h.startsWith("/") || h === "") continue;
      const target = path.resolve(dir, h);
      // Targets outside OUT (e.g., ../news/) aren't validated here.
      if (!target.startsWith(OUT)) continue;
      const candidates = target.endsWith("/")
        ? [path.join(target, "index.html")]
        : [target, path.join(target, "index.html")];
      if (!candidates.some((c) => fs.existsSync(c))) {
        broken++;
        console.warn(`broken link: ${path.relative(ROOT, f)} → ${h}`);
      }
    }
  }
  if (broken === 0) console.log("All internal docs links resolve.");
}

function writeIndex(sections, flat) {
  const title = "Documentation";
  const description = SITE_DESC;
  const canonical = `${SITE_URL}/docs/`;
  const depthPrefix = "../";

  const cards = sections
    .map((sec) => {
      const items = sec.items.map((it) => `<li><a href="${it.href}">${escapeHtml(it.title)}</a></li>`).join("");
      return `<section class="docs-index__group">
        <h2>${escapeHtml(sec.title)}</h2>
        <ul>${items}</ul>
      </section>`;
    })
    .join("");

  const body = `<h1 id="nyx-documentation">Nyx documentation</h1>
<p class="docs-index__lede">Local-first SAST for developers. Source-to-sink taint, browser triage, SARIF, CI. Get running in minutes, then read deeper.</p>
<div class="docs-index__grid">
  ${cards}
</div>`;

  const sidebar = renderSidebar(sections, "index.html");
  const jsonLd = pageJsonLd({
    title,
    description,
    canonical,
    section: "Documentation",
    parentHref: null,
    parentTitle: null,
    isIndex: true,
  });
  const keywords = [
    "Nyx",
    "Nyx scanner",
    "Nyx documentation",
    "SAST",
    "static analysis",
    "Rust security scanner",
    "local-first SAST",
    "taint analysis",
    "SARIF",
  ];
  const nextHref = flat.length ? flat[0].href : null;
  const html = pageTemplate({
    title,
    description,
    keywords,
    canonical,
    sidebar,
    prevNext: "",
    body,
    depthPrefix,
    isIndex: true,
    jsonLd,
    nextHref,
  });
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}

build();
