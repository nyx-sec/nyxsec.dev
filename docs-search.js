(() => {
  const root = document.querySelector("[data-docs-search]");
  if (!root) return;

  const input = root.querySelector("[data-docs-search-input]");
  const panel = root.querySelector("[data-docs-search-panel]");
  const resultsEl = root.querySelector("[data-docs-search-results]");
  const statusEl = root.querySelector("[data-docs-search-status]");
  const script =
    document.currentScript ||
    document.querySelector('script[src$="/docs/search.js"], script[src$="docs/search.js"], script[src$="search.js"]');
  const docsBaseUrl = new URL("./", script ? script.src : window.location.href);
  const pagefindUrl = new URL("pagefind/pagefind.js", docsBaseUrl);
  const docsRootPath = docsBaseUrl.pathname.replace(/\/$/, "");
  const selectedResultKey = "nyx-docs-selected-search-result";

  let pagefind = null;
  let loadPromise = null;
  let loadFailed = false;
  let activeIndex = -1;
  let currentResults = [];
  let searchRun = 0;
  let inputTimer = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function targetIdFromHash(hash) {
    if (!hash) return "";
    try {
      return decodeURIComponent(hash.slice(1));
    } catch {
      return hash.slice(1);
    }
  }

  function resultUrl(record) {
    const url = record.url || "";
    if (/^[a-z]+:/i.test(url) || url.startsWith("/")) {
      return new URL(url, window.location.origin);
    }
    const cleanUrl = url.replace(/^\.\//, "");
    const docsRootName = docsRootPath.replace(/^\//, "");
    if (docsRootName && (cleanUrl === docsRootName || cleanUrl.startsWith(`${docsRootName}/`))) {
      return new URL(`/${cleanUrl}`, window.location.origin);
    }
    return new URL(cleanUrl, docsBaseUrl);
  }

  function clearTargetHighlights() {
    document.querySelectorAll(".docs-search-target").forEach((node) => {
      node.classList.remove("docs-search-target");
    });
  }

  function highlightTarget(id) {
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    clearTargetHighlights();
    target.classList.add("docs-search-target");
    window.setTimeout(() => {
      target.classList.remove("docs-search-target");
    }, 3600);
  }

  function selectedResultForCurrentPage() {
    let selected = null;
    try {
      selected = JSON.parse(sessionStorage.getItem(selectedResultKey) || "null");
    } catch {
      selected = null;
    }
    if (!selected || selected.expires < Date.now()) return null;
    if (selected.path !== window.location.pathname || selected.hash !== window.location.hash) return null;
    return selected;
  }

  function applySelectedResultHighlight() {
    const selected = selectedResultForCurrentPage();
    if (!selected) return;
    highlightTarget(targetIdFromHash(window.location.hash));
    try {
      sessionStorage.removeItem(selectedResultKey);
    } catch {
      // No-op: the highlight itself already happened.
    }
  }

  function compact(value, max = 170) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}...`;
  }

  function fallbackTitle(url) {
    const path = resultUrl({ url })
      .pathname.replace(/^\/docs\/?/, "")
      .replace(/\/index\.html$/, "")
      .replace(/\.html$/, "")
      .replace(/\//g, " / ")
      .replace(/-/g, " ")
      .trim();
    return path || "Documentation";
  }

  function pageLabel(url) {
    const path = resultUrl({ url })
      .pathname.replace(/^\/docs\/?/, "")
      .replace(/\/index\.html$/, "")
      .replace(/\.html$/, "")
      .replace(/\//g, " / ")
      .trim();
    return path || "Docs";
  }

  function excerptHtml(record) {
    if (record.excerpt) return String(record.excerpt);
    return escapeHtml(compact(record.plainExcerpt));
  }

  function loadPagefind() {
    if (pagefind) return Promise.resolve(pagefind);
    if (loadPromise) return loadPromise;

    statusEl.textContent = "Loading";
    openPanel();

    loadPromise = import(pagefindUrl.href)
      .then(async (module) => {
        if (typeof module.options === "function") {
          await module.options({ baseUrl: "/" });
        }
        pagefind = module;
        loadFailed = false;
        return pagefind;
      })
      .catch(() => {
        loadFailed = true;
        statusEl.textContent = "Search unavailable";
        resultsEl.innerHTML = "";
        return null;
      });

    return loadPromise;
  }

  function flattenPagefindResults(pageResults) {
    const flat = [];
    for (const { data, rank } of pageResults) {
      const pageTitle = data.meta?.title || fallbackTitle(data.url);
      const subResults = Array.isArray(data.sub_results) && data.sub_results.length ? data.sub_results : [data];
      for (const [subRank, sub] of subResults.slice(0, 3).entries()) {
        const url = sub.url || data.url;
        flat.push({
          title: sub.title || pageTitle,
          url,
          excerpt: sub.excerpt || data.excerpt || "",
          plainExcerpt: sub.plain_excerpt || data.plain_excerpt || "",
          pageTitle,
          pageLabel: pageLabel(data.url),
          rank,
          subRank,
        });
        if (flat.length >= 10) return flat;
      }
    }
    return flat;
  }

  function openPanel() {
    root.classList.add("is-open");
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    root.classList.remove("is-open");
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function setActive(index) {
    const links = [...resultsEl.querySelectorAll(".docs-search__result")];
    if (!links.length) {
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }

    activeIndex = (index + links.length) % links.length;
    links.forEach((link, i) => {
      const selected = i === activeIndex;
      link.classList.toggle("is-active", selected);
      link.setAttribute("aria-selected", selected ? "true" : "false");
    });
    input.setAttribute("aria-activedescendant", links[activeIndex].id);
    links[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function render(entries, query) {
    currentResults = entries;
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");

    if (!query) {
      closePanel();
      statusEl.textContent = "";
      resultsEl.innerHTML = "";
      return;
    }

    openPanel();

    if (!entries.length) {
      statusEl.textContent = "No results";
      resultsEl.innerHTML = "";
      return;
    }

    statusEl.textContent = `${entries.length} result${entries.length === 1 ? "" : "s"}`;
    resultsEl.innerHTML = entries
      .map((record, index) => {
        const url = resultUrl(record);
        const meta = record.title === record.pageTitle ? record.pageLabel : `${record.pageLabel} / ${record.pageTitle}`;
        return `<a class="docs-search__result" id="docs-search-result-${index}" href="${escapeAttr(url.toString())}" data-docs-search-result="${index}" role="option" aria-selected="false">
          <span class="docs-search__result-title">${escapeHtml(record.title)}</span>
          <span class="docs-search__result-meta">${escapeHtml(meta)}</span>
          <span class="docs-search__result-excerpt">${excerptHtml(record)}</span>
        </a>`;
      })
      .join("");
  }

  async function search() {
    const query = input.value.trim();
    const run = ++searchRun;

    if (!query) {
      render([], "");
      return;
    }

    if (loadFailed) {
      openPanel();
      statusEl.textContent = "Search unavailable";
      resultsEl.innerHTML = "";
      return;
    }

    openPanel();
    statusEl.textContent = "Searching";

    const api = await loadPagefind();
    if (!api || run !== searchRun) return;

    try {
      const response = await api.search(query);
      if (run !== searchRun) return;

      const pageResults = await Promise.all(
        response.results.slice(0, 8).map(async (result, rank) => ({
          data: await result.data(),
          rank,
        })),
      );
      if (run !== searchRun) return;

      render(flattenPagefindResults(pageResults), query);
    } catch {
      if (run !== searchRun) return;
      statusEl.textContent = "Search unavailable";
      resultsEl.innerHTML = "";
    }
  }

  function scheduleSearch() {
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(search, 80);
  }

  function focusSearch() {
    input.focus();
    input.select();
    if (input.value.trim()) {
      search();
    } else {
      render([], "");
    }
  }

  input.addEventListener("focus", focusSearch);
  input.addEventListener("input", scheduleSearch);

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (panel.hidden) search();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const link = resultsEl.querySelectorAll(".docs-search__result")[activeIndex];
      if (link) link.click();
    } else if (event.key === "Escape") {
      if (input.value) {
        input.value = "";
        render([], "");
      } else {
        closePanel();
        input.blur();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable;
    const key = event.key.toLowerCase();

    if ((event.metaKey || event.ctrlKey) && key === "k") {
      event.preventDefault();
      focusSearch();
      return;
    }

    if (!isTyping && event.key === "/") {
      event.preventDefault();
      focusSearch();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target)) closePanel();
  });

  resultsEl.addEventListener("pointermove", (event) => {
    const link = event.target.closest(".docs-search__result");
    if (!link) return;
    const links = [...resultsEl.querySelectorAll(".docs-search__result")];
    setActive(links.indexOf(link));
  });

  resultsEl.addEventListener("click", (event) => {
    const link = event.target.closest(".docs-search__result");
    if (link) {
      const record = currentResults[Number(link.dataset.docsSearchResult)];
      const url = new URL(link.href);
      try {
        sessionStorage.setItem(
          selectedResultKey,
          JSON.stringify({
            path: url.pathname,
            hash: url.hash,
            title: record ? record.title : "",
            query: input.value.trim(),
            expires: Date.now() + 15000,
          }),
        );
      } catch {
        // Session storage is only a convenience for the destination highlight.
      }

      if (url.pathname === window.location.pathname && url.hash) {
        window.setTimeout(() => highlightTarget(targetIdFromHash(url.hash)), 80);
      }
    }
    closePanel();
  });

  window.addEventListener("hashchange", applySelectedResultHighlight);
  window.setTimeout(applySelectedResultHighlight, 0);
})();
