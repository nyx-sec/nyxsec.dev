#!/usr/bin/env node
/* eslint-disable no-console */
// Build nyxsec.dev/docs/ from markdown in docs-src/.
// Source of truth lives in /Users/elipeter/nyx/docs and /Users/elipeter/nyctos/docs
// (see tools/sync-docs.sh).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { marked } = require("marked");
const hljs = require("highlight.js");

const ROOT = path.resolve(__dirname, "..");
const SRC_ROOT = path.join(ROOT, "docs-src");
const OUT = path.join(ROOT, "docs");
const SITE_URL = "https://nyxsec.dev";

const HUB_DESC =
  "Documentation for Nyx Scanner and Nyx Agent: local source-to-sink scanning, local pentesting, CLI usage, configuration, APIs, and operations.";

const DOC_SETS = [
  {
    id: "nyx",
    slug: "nyx",
    sourceDir: path.join(SRC_ROOT, "nyx"),
    shortName: "Nyx",
    productName: "Nyx Scanner",
    sidebarTitle: "Nyx docs",
    indexTitle: "Nyx Scanner Documentation",
    indexHeading: "Nyx Scanner documentation",
    indexLede:
      "Deterministic local-first SAST for source-to-sink taint, browser triage, SARIF, CI, configuration, and detector internals.",
    description:
      "Documentation for Nyx Scanner, the open-source, local-first SAST scanner written in Rust. Quickstart, CLI reference, detectors, configuration, and language coverage.",
    productDescription:
      "Deterministic source-to-sink scanning for local code. No cloud, no account, no telemetry.",
    keywordsBase: [
      "Nyx",
      "Nyx scanner",
      "SAST",
      "static analysis",
      "Rust security scanner",
      "local-first SAST",
    ],
    github: "https://github.com/elicpeter/nyx",
    softwareId: `${SITE_URL}/scanner#software`,
    productUrl: `${SITE_URL}/scanner`,
    alternateNames: ["Nyx Scanner", "nyx-scanner"],
    applicationSubCategory: "Static Application Security Testing",
    programmingLanguage: "Rust",
    licenseUrl: "https://spdx.org/licenses/GPL-3.0-or-later.html",
    packageUrl: "https://crates.io/crates/nyx-scanner",
    rustdocsUrl: "https://docs.rs/nyx-scanner/latest/nyx_scanner/",
    releaseNotesUrl: `${SITE_URL}/news/nyx-0-7-0`,
    featureList: [
      "Cross-file interprocedural taint analysis",
      "Local browser triage UI",
      "SARIF output for CI",
      "No account or source upload required",
    ],
    licenseLine: "Nyx is licensed under GPL-3.0-or-later.",
    ogAlt: "Nyx Scanner local-first security documentation",
    suggestedLinks: ["quickstart.html", "installation.html", "cli.html"],
  },
  {
    id: "agent",
    slug: "agent",
    sourceDir: path.join(SRC_ROOT, "agent"),
    shortName: "Nyx Agent",
    productName: "Nyx Agent",
    sidebarTitle: "Agent docs",
    indexTitle: "Nyx Agent Documentation",
    indexHeading: "Nyx Agent documentation",
    indexLede:
      "Operator docs for local pentests against development apps: setup, daemon operation, projects, runs, API, triggers, CI, and AI runtime wiring.",
    description:
      "Documentation for Nyx Agent, the local pentesting product for development apps. Install, quickstart, CLI, configuration, API, triggers, runs, and architecture.",
    productDescription:
      "Local pentesting against development apps with route exploration, verification, evidence capture, triggers, and project-level runs.",
    keywordsBase: [
      "Nyx Agent",
      "nyx-agent",
      "local pentesting",
      "live appsec testing",
      "verified vulnerabilities",
      "stored evidence",
    ],
    github: "https://github.com/nyx-sec/nyx-agent",
    softwareId: `${SITE_URL}/agent#software`,
    productUrl: `${SITE_URL}/agent`,
    alternateNames: ["nyx-agent"],
    applicationSubCategory: "Local Application Security Testing",
    programmingLanguage: "Rust, TypeScript",
    licenseUrl: "https://spdx.org/licenses/AGPL-3.0-or-later.html",
    packageUrl: "https://github.com/nyx-sec/nyx-agent",
    rustdocsUrl: null,
    releaseNotesUrl: `${SITE_URL}/news/nyx-agent`,
    featureList: [
      "Local pentest runs for development apps",
      "Route and API exploration",
      "Live verification with stored evidence",
      "Project-level run history and triggers",
    ],
    licenseLine: "Nyx Agent is licensed under AGPL-3.0-or-later.",
    ogAlt: "Nyx Agent local pentesting documentation",
    suggestedLinks: ["quickstart.html", "install.html", "cli.html"],
  },
];

// ---------------------------------------------------------------------------
// Marked config - highlight via highlight.js
// ---------------------------------------------------------------------------
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

renderer.link = function ({ href, title, tokens }) {
  const h = publicHref(rewriteMarkdownHref(href || ""));
  const inner = this.parser.parseInline(tokens);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeAttr(h)}"${titleAttr}>${inner}</a>`;
};

function rewriteMarkdownHref(href) {
  let h = href || "";
  if (h && !/^[a-z]+:/i.test(h) && !h.startsWith("#") && !h.startsWith("//")) {
    h = h.replace(/(^|\/)README\.md(?=$|[#?])/i, "$1index.html");
    h = h.replace(/\.md(?=$|[#?])/i, ".html");
    h = h.replace(/(^|\/)CHANGELOG\.html/, "$1changelog.html");
    h = h.replace(/(^|\/)ROADMAP\.html/, "$1roadmap.html");
  }
  return h;
}

function publicHref(href) {
  if (!href || /^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("//")) {
    return href;
  }

  const match = /^([^?#]*)([?#].*)?$/.exec(href);
  const base = match ? match[1] : href;
  const suffix = match && match[2] ? match[2] : "";

  if (base === "index.html") return `./${suffix}`;
  if (base === "/index.html") return `/${suffix}`;
  if (base.endsWith("/index.html")) return `${base.slice(0, -"index.html".length)}${suffix}`;
  if (base.endsWith(".html")) return `${base.slice(0, -".html".length)}${suffix}`;
  return href;
}

// ---------------------------------------------------------------------------
// Include resolver - mdbook {{#include path}}
// ---------------------------------------------------------------------------
function resolveIncludes(md, filePath, set) {
  return md.replace(/\{\{\s*#include\s+([^}\s]+)\s*\}\}/g, (_, inc) => {
    const candidates = [
      path.resolve(path.dirname(filePath), inc),
      path.join(set.sourceDir, path.basename(inc)),
      path.join(SRC_ROOT, path.basename(inc)),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        let inner = fs.readFileSync(c, "utf8");
        inner = inner.replace(/^#\s+[^\n]+\n+/, "");
        return inner;
      }
    }
    console.warn(`warn: include not resolved: ${inc} (from ${filePath})`);
    return "";
  });
}

// ---------------------------------------------------------------------------
// SUMMARY.md -> sidebar tree
// ---------------------------------------------------------------------------
function parseSummary(md) {
  const sections = [];
  let current = null;
  const lines = md.split("\n");
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      if (/^summary$/i.test(title)) {
        current = null;
        continue;
      }
      if (level === 1 && sections.length === 0 && /docs|documentation/i.test(title)) {
        current = null;
        continue;
      }
      if (level <= 2) {
        current = { title, items: [] };
        sections.push(current);
      }
      continue;
    }

    const item = /^(\s*)-\s*\[([^\]]+)\]\(([^)]+)\)(?:\s*:.*)?\s*$/.exec(line);
    if (item && current) {
      const indent = item[1].length;
      const rawHref = item[3].trim();
      const node = {
        title: humanizeLinkTitle(item[2].trim(), rawHref),
        href: rewriteMarkdownHref(rawHref),
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
  return sections.filter((section) => section.items.length > 0);
}

function humanizeLinkTitle(rawTitle, href) {
  const titleLooksLikePath = /\.md(?:$|[#?])/i.test(rawTitle) || rawTitle === href;
  if (!titleLooksLikePath) return rawTitle;

  const cleanHref = href.split(/[?#]/)[0];
  let base = path.posix.basename(cleanHref, path.posix.extname(cleanHref));
  if (/^README$/i.test(base)) base = "overview";

  const title = humanizeSlug(base);
  const hash = /#([^?]+)/.exec(href);
  return hash ? `${title}: ${humanizeSlug(hash[1])}` : title;
}

function humanizeSlug(value) {
  const acronyms = new Map([
    ["ai", "AI"],
    ["api", "API"],
    ["ci", "CI"],
    ["cli", "CLI"],
    ["cfg", "CFG"],
    ["csrf", "CSRF"],
    ["dir", "Directory"],
    ["github", "GitHub"],
    ["hmac", "HMAC"],
    ["sarif", "SARIF"],
    ["sqlx", "SQLx"],
    ["ui", "UI"],
    ["websocket", "WebSocket"],
  ]);
  const smallWords = new Set(["a", "an", "and", "as", "for", "in", "of", "or", "the", "to", "with"]);
  return String(value)
    .replace(/\.md$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (acronyms.has(lower)) return acronyms.get(lower);
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
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

function stripUrlParts(href) {
  return href.split(/[?#]/)[0];
}

function uniquePages(flat) {
  const seen = new Set();
  const pages = [];
  for (const item of flat) {
    const href = stripUrlParts(item.href);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    pages.push({ ...item, href });
  }
  return pages;
}

function navEntryFor(flat, href) {
  return (
    flat.find((n) => stripUrlParts(n.href) === href && !/[#?]/.test(n.href)) ||
    flat.find((n) => stripUrlParts(n.href) === href) ||
    null
  );
}

function markdownRelFromHref(href) {
  const clean = stripUrlParts(href);
  if (!clean || clean.endsWith("/")) return null;
  if (clean.endsWith("index.html")) {
    const dir = clean.slice(0, -"index.html".length);
    return `${dir}README.md`;
  }
  return clean.replace(/\.html$/i, ".md");
}

function outRelFromMarkdownRel(rel) {
  const normalized = toUrlPath(rel);
  if (/^README\.md$/i.test(path.posix.basename(normalized))) {
    const dir = path.posix.dirname(normalized);
    return dir === "." ? "index.html" : `${dir}/index.html`;
  }
  return normalized.replace(/\.md$/i, ".html");
}

function markdownFilesFromNav(set, flat) {
  const refs = new Set();
  for (const item of flat) {
    const rel = markdownRelFromHref(item.href);
    if (rel) refs.add(rel);
  }

  const files = [];
  for (const rel of refs) {
    const srcFile = path.join(set.sourceDir, rel);
    if (fs.existsSync(srcFile)) {
      files.push(rel);
    } else {
      console.warn(`warn: nav page not found for ${set.id}: ${rel}`);
    }
  }
  return files;
}

function navIndex(flatPages) {
  const map = new Map();
  for (const n of flatPages) map.set(n.href, n);
  return map;
}

function deriveKeywords(title, section, body, set) {
  const extra = [];
  if (section) extra.push(section);
  if (title) extra.push(title);
  const tokens =
    body.match(
      /\b(taint|SARIF|CFG|SSA|SBOM|CVE|RCE|SSRF|XSS|FastAPI|Rust|Python|Go|JavaScript|TypeScript|Java|TOML|JSON|API|WebSocket|cron|HMAC|AI)\b/gi,
    ) || [];
  for (const t of tokens) if (!extra.includes(t)) extra.push(t);
  return [...set.keywordsBase, ...extra.slice(0, 6)];
}

function pageJsonLd({ title, description, canonical, section, parentHref, parentTitle, isIndex, set }) {
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE_URL}/docs/` },
    ],
  };

  if (set) {
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 3,
      name: `${set.productName} docs`,
      item: `${SITE_URL}/docs/${set.slug}/`,
    });
  }

  if (set && parentHref && parentTitle) {
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 4,
      name: parentTitle,
      item: `${SITE_URL}/docs/${set.slug}/${publicHref(parentHref)}`,
    });
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 5,
      name: title,
      item: canonical,
    });
  } else if (set && !isIndex) {
    breadcrumb.itemListElement.push({
      "@type": "ListItem",
      position: 4,
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

  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Nyx",
    alternateName: ["Nyx Scanner", "Nyx Agent", "NyxSec", "nyxsec.dev"],
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/assets/logo.png`,
      width: 512,
      height: 512,
    },
    founder: { "@id": `${SITE_URL}/#person` },
    sameAs: [
      "https://github.com/elicpeter/nyx",
      "https://github.com/nyx-sec/nyx-agent",
      "https://github.com/sponsors/elicpeter",
    ],
    knowsAbout: [
      "Static Application Security Testing",
      "source-to-sink taint analysis",
      "local pentesting",
      "software supply chain security",
      "SARIF",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "commercial licensing and support",
      email: "contact@nyxsec.dev",
      availableLanguage: ["en"],
    },
  };

  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: "Nyx",
    alternateName: "nyxsec.dev",
    description: "Local security tooling for deterministic scanning and live testing.",
    inLanguage: "en-US",
    publisher: { "@id": `${SITE_URL}/#organization` },
    creator: { "@id": `${SITE_URL}/#person` },
  };

  const software = set
    ? {
        "@type": ["SoftwareApplication", "SoftwareSourceCode"],
        "@id": set.softwareId,
        name: set.id === "nyx" ? "Nyx" : set.productName,
        alternateName: set.alternateNames,
        url: set.productUrl,
        applicationCategory: "SecurityApplication",
        applicationSubCategory: set.applicationSubCategory,
        operatingSystem: "Cross-platform",
        programmingLanguage: set.programmingLanguage,
        codeRepository: set.github,
        downloadUrl: set.packageUrl,
        installUrl: canonicalFor(set, set.id === "nyx" ? "installation.html" : "install.html"),
        softwareHelp: `${SITE_URL}/docs/${set.slug}/`,
        releaseNotes: set.releaseNotesUrl,
        license: set.licenseUrl,
        description: set.description,
        featureList: set.featureList,
        maintainer: { "@id": `${SITE_URL}/#person` },
        author: { "@id": `${SITE_URL}/#person` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isAccessibleForFree: true,
        sameAs: [set.github, `${SITE_URL}/docs/${set.slug}/`, set.packageUrl, set.rustdocsUrl].filter(Boolean),
      }
    : null;

  const articleType = set ? "TechArticle" : "CollectionPage";
  const articleId = isIndex ? `${canonical}#page` : `${canonical}#article`;
  const graph = [
    person,
    organization,
    website,
    {
      "@type": articleType,
      "@id": articleId,
      headline: title,
      name: title,
      url: canonical,
      description,
      inLanguage: "en-US",
      articleSection: section || "Documentation",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      author: { "@id": `${SITE_URL}/#person` },
      image: `${SITE_URL}/og-image.png`,
      mainEntityOfPage: canonical,
      ...(set
        ? {
            about: { "@id": set.softwareId },
            mainEntity: { "@id": set.softwareId },
          }
        : {}),
    },
    { ...breadcrumb, "@id": `${canonical}#breadcrumbs` },
  ];
  if (software) graph.splice(3, 0, software);

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

// ---------------------------------------------------------------------------
// Sidebar + search
// ---------------------------------------------------------------------------
function renderSidebar(set, sections, currentHref) {
  const norm = (h) => stripUrlParts(h).replace(/^\.\//, "");
  const isCurrent = (h) => norm(h) === norm(currentHref);
  const depth = currentHref.split("/").length - 1;
  const upPrefix = "../".repeat(depth);
  const rel = (h) => publicHref(upPrefix ? upPrefix + h : h);
  const setRootHref = depth === 0 ? "./" : upPrefix;

  const parts = ['<nav class="docs-sidebar" aria-label="Documentation">'];
  parts.push(`<a class="docs-sidebar__brand" href="${setRootHref}">${escapeHtml(set.sidebarTitle)}</a>`);
  parts.push(`<a class="docs-sidebar__home" href="${rel("../")}">All docs</a>`);
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

function renderHubSidebar() {
  const items = DOC_SETS.map(
    (set) => `<li><a class="docs-sidebar__link" href="${set.slug}/">${escapeHtml(set.productName)}</a></li>`,
  ).join("");
  return `<nav class="docs-sidebar" aria-label="Documentation">
    <a class="docs-sidebar__brand" href="">Docs</a>
    <div class="docs-sidebar__group">
      <h2 class="docs-sidebar__heading">Products</h2>
      <ul class="docs-sidebar__list">${items}</ul>
    </div>
  </nav>`;
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

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function extractFirstHeading(md) {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : null;
}

function stripFirstHeading(md) {
  return md.replace(/^#\s+[^\n]+\n+/, "");
}

function plainSummary(md, max = 158) {
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
  let para = paras.find((p) => p.length > 40 && !p.endsWith(":")) || paras[0] || "";
  if (para.length <= max) return para;
  return (
    para
      .slice(0, max - 1)
      .replace(/\s+\S*$/, "")
      .replace(/[,;:]\s*$/, "") + "..."
  );
}

function canonicalFor(set, outRelKey) {
  if (!set) return `${SITE_URL}/docs/`;
  if (outRelKey === "index.html") return `${SITE_URL}/docs/${set.slug}/`;
  if (outRelKey.endsWith("/index.html")) {
    return `${SITE_URL}/docs/${set.slug}/${outRelKey.slice(0, -"index.html".length)}`;
  }
  return `${SITE_URL}/docs/${set.slug}/${outRelKey.replace(/\.html$/i, "")}`;
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
  set,
}) {
  const p = depthPrefix;
  const fullTitle = set
    ? isIndex
      ? `${title} | Nyx docs`
      : `${title} | ${set.shortName} docs`
    : `${title} | Nyx`;
  const kw =
    keywords && keywords.length ? `\n    <meta name="keywords" content="${escapeHtml(keywords.join(", "))}" />` : "";
  const prevLink = prevHref ? `\n    <link rel="prev" href="${escapeAttr(prevHref)}" />` : "";
  const nextLink = nextHref ? `\n    <link rel="next" href="${escapeAttr(nextHref)}" />` : "";
  const ogType = isIndex ? "website" : "article";
  const jsonLdBlock = jsonLd
    ? `\n    <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>`
    : "";
  const ogAlt = set ? set.ogAlt : "Nyx documentation for local security tools";
  const footerLine = set ? set.licenseLine : "Nyx is an independent open-source security project.";
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
    <link rel="alternate" type="application/rss+xml" title="Nyx | News &amp; release notes" href="/news/feed.xml" />
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
    <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.png" />
    <meta name="twitter:image:alt" content="${escapeHtml(ogAlt)}" />
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
          <a href="${p}scanner">Scanner</a>
          <a href="${p}agent">Agent</a>
          <a href="${p}news/">News</a>
          <a href="${p}docs/" aria-current="page">Docs</a>
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
        <div class="site-footer__summary">
          <span class="site-footer__brand">Nyx</span>
          <p class="site-footer__copy">© ${new Date().getFullYear()} Eli Peter · ${escapeHtml(footerLine)}</p>
        </div>
        <nav class="site-footer__nav" aria-label="Footer">
          <div class="site-footer__group" role="group" aria-labelledby="footer-project">
            <span id="footer-project" class="site-footer__heading">Project</span>
            <a href="${p}">Home</a>
            <a href="${p}news/">News</a>
            <a href="${p}docs/">All docs</a>
            <a href="https://github.com/sponsors/elicpeter">Sponsor</a>
          </div>
          <div class="site-footer__group" role="group" aria-labelledby="footer-scanner">
            <span id="footer-scanner" class="site-footer__heading">Scanner</span>
            <a href="${p}scanner">Overview</a>
            <a href="${p}docs/nyx/">Docs</a>
            <a href="https://github.com/elicpeter/nyx">GitHub</a>
            <a href="https://crates.io/crates/nyx-scanner">crates.io</a>
            <a href="https://docs.rs/nyx-scanner/latest/nyx_scanner/">Rustdocs</a>
          </div>
          <div class="site-footer__group" role="group" aria-labelledby="footer-agent">
            <span id="footer-agent" class="site-footer__heading">Agent</span>
            <a href="${p}agent">Overview</a>
            <a href="${p}docs/agent/">Docs</a>
            <a href="https://github.com/nyx-sec/nyx-agent">GitHub</a>
            <a href="${p}agent#support">Support</a>
          </div>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

function renderPrevNext(flatPages, href) {
  const idx = flatPages.findIndex((x) => x.href === href);
  if (idx < 0) return "";
  const prev = idx > 0 ? flatPages[idx - 1] : null;
  const next = idx < flatPages.length - 1 ? flatPages[idx + 1] : null;
  if (!prev && !next) return "";
  const depth = href.split("/").length - 1;
  const upPrefix = "../".repeat(depth);
  const rel = (h) => (upPrefix ? upPrefix + h : h);
  const prevHtml = prev
    ? `<a class="docs-prevnext__link docs-prevnext__link--prev" href="${publicHref(rel(prev.href))}">
        <span class="docs-prevnext__label">Previous</span>
        <span class="docs-prevnext__title">${escapeHtml(prev.title)}</span>
      </a>`
    : '<span class="docs-prevnext__spacer"></span>';
  const nextHtml = next
    ? `<a class="docs-prevnext__link docs-prevnext__link--next" href="${publicHref(rel(next.href))}">
        <span class="docs-prevnext__label">Next</span>
        <span class="docs-prevnext__title">${escapeHtml(next.title)}</span>
      </a>`
    : '<span class="docs-prevnext__spacer"></span>';
  return `<nav class="docs-prevnext" aria-label="Page navigation">${prevHtml}${nextHtml}</nav>`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
function copyAssets(set) {
  const srcAssets = path.join(set.sourceDir, "assets");
  if (!fs.existsSync(srcAssets)) return;
  const dst = path.join(OUT, set.slug, "assets");
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
    throw new Error("Pagefind missing - run `npm install` first.");
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

function toUrlPath(rel) {
  return rel.split(path.sep).join("/");
}

function buildDocSet(set) {
  const summaryPath = path.join(set.sourceDir, "SUMMARY.md");
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`${summaryPath} missing - run \`npm run docs:sync\` first.`);
  }

  const summaryRaw = fs.readFileSync(summaryPath, "utf8");
  const sections = parseSummary(summaryRaw);
  const flat = flattenNav(sections);
  const flatPages = uniquePages(flat);
  const navMap = navIndex(flatPages);
  const mdFiles = markdownFilesFromNav(set, flat);

  for (const rel of mdFiles) {
    const srcFile = path.join(set.sourceDir, rel);
    const outRelKey = outRelFromMarkdownRel(rel);
    const outFile = path.join(OUT, set.slug, outRelKey);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    let md = fs.readFileSync(srcFile, "utf8");
    md = resolveIncludes(md, srcFile, set);
    md = md.replace(/nyxscan\.dev/g, "nyxsec.dev");

    const title = extractFirstHeading(md) || path.basename(rel, ".md");
    const description = plainSummary(stripFirstHeading(md)) || set.description;

    resetSlugs();
    const body = marked.parse(md, { renderer });

    const docRel = `${set.slug}/${outRelKey}`;
    const depthPrefix = "../".repeat(docRel.split("/").length);
    const canonical = canonicalFor(set, outRelKey);
    const sidebar = renderSidebar(set, sections, outRelKey);
    const prevNext = renderPrevNext(flatPages, outRelKey);

    const navEntry = navEntryFor(flat, outRelKey) || navMap.get(outRelKey);
    const section = navEntry ? navEntry.section : null;
    const parentHref = navEntry && navEntry.parent ? stripUrlParts(navEntry.parent.href) : null;
    const parentTitle = navEntry && navEntry.parent ? navEntry.parent.title : null;
    const keywords = deriveKeywords(title, section, md, set);
    const jsonLd = pageJsonLd({
      title,
      description,
      canonical,
      section,
      parentHref,
      parentTitle,
      isIndex: false,
      set,
    });

    const idx = flatPages.findIndex((x) => x.href === outRelKey);
    const upPrefix = "../".repeat(outRelKey.split("/").length - 1);
    const relPath = (h) => (upPrefix ? upPrefix + h : h);
    const prevHref = idx > 0 ? publicHref(relPath(flatPages[idx - 1].href)) : null;
    const nextHref = idx >= 0 && idx < flatPages.length - 1 ? publicHref(relPath(flatPages[idx + 1].href)) : null;

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
      set,
    });
    fs.writeFileSync(outFile, html);
  }

  writeSetIndex(set, sections, flatPages);
  copyAssets(set);

  return { set, pageCount: mdFiles.length, sections, flatPages };
}

function writeSetIndex(set, sections, flatPages) {
  const cards = sections
    .map((sec) => {
      const items = sec.items
        .map((it) => `<li><a href="${escapeAttr(publicHref(it.href))}">${escapeHtml(it.title)}</a></li>`)
        .join("");
      return `<section class="docs-index__group">
        <h2>${escapeHtml(sec.title)}</h2>
        <ul>${items}</ul>
      </section>`;
    })
    .join("");

  const body = `<h1 id="${set.id}-documentation">${escapeHtml(set.indexHeading)}</h1>
<p class="docs-index__lede">${escapeHtml(set.indexLede)}</p>
<div class="docs-index__grid">
  ${cards}
</div>`;

  const canonical = canonicalFor(set, "index.html");
  const jsonLd = pageJsonLd({
    title: set.indexTitle,
    description: set.description,
    canonical,
    section: "Documentation",
    parentHref: null,
    parentTitle: null,
    isIndex: true,
    set,
  });
  const html = pageTemplate({
    title: set.indexTitle,
    description: set.description,
    keywords: [...set.keywordsBase, `${set.productName} docs`, "documentation"],
    canonical,
    sidebar: renderSidebar(set, sections, "index.html"),
    prevNext: "",
    body,
    depthPrefix: "../../",
    isIndex: true,
    jsonLd,
    nextHref: flatPages.length ? publicHref(flatPages[0].href) : null,
    set,
  });
  fs.writeFileSync(path.join(OUT, set.slug, "index.html"), html);
}

function writeHubIndex(results) {
  const bodyCards = results
    .map(({ set, flatPages }) => {
      const links = set.suggestedLinks
        .filter((href) => flatPages.some((page) => page.href === href))
        .map((href) => {
          const page = flatPages.find((entry) => entry.href === href);
          return `<li><a href="${set.slug}/${publicHref(href)}">${escapeHtml(page.title)}</a></li>`;
        })
        .join("");
      return `<section class="docs-index__group docs-index__group--product">
        <h2><a href="${set.slug}/">${escapeHtml(set.productName)}</a></h2>
        <p>${escapeHtml(set.productDescription)}</p>
        <ul>${links}</ul>
      </section>`;
    })
    .join("");

  const body = `<h1 id="documentation">Documentation</h1>
<p class="docs-index__lede">Choose the product you are working with. Nyx Scanner docs stay focused on deterministic source scanning; Nyx Agent docs cover local pentesting, project runs, evidence, triggers, and APIs.</p>
<div class="docs-index__grid docs-index__grid--products">
  ${bodyCards}
</div>`;

  const title = "Documentation";
  const canonical = canonicalFor(null, "index.html");
  const jsonLd = pageJsonLd({
    title,
    description: HUB_DESC,
    canonical,
    section: "Documentation",
    parentHref: null,
    parentTitle: null,
    isIndex: true,
    set: null,
  });
  const html = pageTemplate({
    title,
    description: HUB_DESC,
    keywords: [
      "Nyx documentation",
      "Nyx Scanner docs",
      "Nyx Agent docs",
      "local security tools",
      "SAST",
      "local pentesting",
    ],
    canonical,
    sidebar: renderHubSidebar(),
    prevNext: "",
    body,
    depthPrefix: "../",
    isIndex: true,
    jsonLd,
    nextHref: "nyx/",
    set: null,
  });
  fs.writeFileSync(path.join(OUT, "index.html"), html);
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
      if (!target.startsWith(OUT)) continue;
      const candidates = target.endsWith(path.sep)
        ? [path.join(target, "index.html")]
        : [target, `${target}.html`, path.join(target, "index.html")];
      if (!candidates.some((c) => fs.existsSync(c))) {
        broken++;
        console.warn(`broken link: ${path.relative(ROOT, f)} -> ${h}`);
      }
    }
  }
  if (broken === 0) console.log("All internal docs links resolve.");
}

function build() {
  if (!fs.existsSync(SRC_ROOT)) {
    console.error("docs-src/ missing - run `npm run docs:sync` first.");
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const results = DOC_SETS.map(buildDocSet);
  writeHubIndex(results);

  copySearchScript();
  runPagefind();
  checkInternalLinks();

  const count = results.reduce((sum, result) => sum + result.pageCount + 1, 1);
  console.log(`Built ${count} docs pages -> ${OUT}`);
}

build();
