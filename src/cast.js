window.NT = window.NT || {};

(function () {
  const { SECTION_HEADING_RE } = NT.constants;

  function headingLevel(el) {
    if (el.classList && el.classList.contains("mw-heading")) {
      const inner = el.querySelector("h1,h2,h3,h4,h5,h6");
      return inner ? parseInt(inner.tagName.slice(1), 10) : 99;
    }
    if (/^H[1-6]$/.test(el.tagName)) return parseInt(el.tagName.slice(1), 10);
    return null;
  }

  function findCastSections() {
    const headings = document.querySelectorAll(
      "#mw-content-text h2, #mw-content-text h3, #mw-content-text h4"
    );
    const sections = [];
    for (const h of headings) {
      const text = (
        h.querySelector(".mw-headline")?.textContent ||
        h.textContent ||
        ""
      ).trim();
      if (SECTION_HEADING_RE.test(text)) {
        sections.push(h);
      }
    }
    return sections;
  }

  function collectSectionContent(heading) {
    const level = headingLevel(heading) ?? 99;
    const start = heading.closest(".mw-heading") || heading;
    const nodes = [];
    let cur = start.nextElementSibling;
    while (cur) {
      const lvl = headingLevel(cur);
      if (lvl !== null && lvl <= level) break;
      nodes.push(cur);
      cur = cur.nextElementSibling;
    }
    return nodes;
  }

  function cleanName(s) {
    return s
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/[*†‡§]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeName(s) {
    if (!s) return false;
    if (s.length < 2 || s.length > 80) return false;
    if (!/^[A-Z]/.test(s)) return false;
    const toks = s.split(/\s+/);
    if (toks.length > 5) return false;
    return toks.every((t) => /^[\p{L}'’\-\.]+$/u.test(t));
  }

  function extractFromTable(table) {
    const names = [];
    const rows = table.querySelectorAll("tr");
    let charColIdx = null;
    const headerRow = rows[0];
    if (headerRow) {
      const headers = headerRow.querySelectorAll("th, td");
      for (let i = 0; i < headers.length; i++) {
        const ht = headers[i].textContent.trim().toLowerCase();
        if (/character|role/.test(ht) && !/actor|actress|performer/.test(ht)) {
          charColIdx = i;
          break;
        }
      }
    }
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cells = row.querySelectorAll("td");
      if (cells.length === 0) continue;
      let cell;
      if (charColIdx !== null && cells[charColIdx]) {
        cell = cells[charColIdx];
      } else if (cells.length >= 2) {
        cell = cells[1];
      } else {
        continue;
      }
      const raw = cell.textContent || "";
      const name = cleanName(raw.split(/\n|,|–|—|\(/)[0] || "");
      if (looksLikeName(name)) names.push(name);
    }
    return names;
  }

  function extractFromList(list) {
    const names = [];
    const items = list.querySelectorAll(":scope > li");
    for (const li of items) {
      const raw = li.textContent || "";
      const m = raw.match(/\bas\s+([^,–—\n(]+)/);
      if (m) {
        const name = cleanName(m[1]);
        if (looksLikeName(name)) names.push(name);
      }
    }
    return names;
  }

  function harvestCast() {
    if (!NT.site.config.castEnabled) return [];
    const sections = findCastSections();
    const all = [];
    for (const heading of sections) {
      const nodes = collectSectionContent(heading);
      for (const node of nodes) {
        const tables =
          node.matches && node.matches("table.wikitable")
            ? [node]
            : node.querySelectorAll
            ? node.querySelectorAll("table.wikitable")
            : [];
        for (const t of tables) all.push(...extractFromTable(t));

        const lists =
          node.tagName === "UL"
            ? [node]
            : node.querySelectorAll
            ? node.querySelectorAll("ul")
            : [];
        for (const l of lists) all.push(...extractFromList(l));
      }
    }
    return [...new Set(all)];
  }

  NT.cast = { harvestCast };
})();
