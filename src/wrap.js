window.NT = window.NT || {};

(function () {
  const { SKIP_SELECTOR } = NT.detect;

  function isInsideSkippedOrWrapped(node, root) {
    let p = node.parentElement;
    while (p && p !== root) {
      if (p.classList && p.classList.contains("nt-name")) return true;
      if (p.matches && p.matches(SKIP_SELECTOR)) return true;
      p = p.parentElement;
    }
    return false;
  }

  const HTML_NS = "http://www.w3.org/1999/xhtml";

  // In a flex/grid container, every contiguous text run and every element
  // child becomes its own anonymous item whose leading/trailing whitespace is
  // stripped. Splitting a text node into [text, span, ...] siblings there drops
  // the spaces adjacent to our spans — e.g. a "Get started with Jira" button
  // renders "Get started withJira". When the parent is such a container we nest
  // the whole replacement inside one inline wrapper so it stays a single item
  // and the internal spaces are preserved.
  function isFlexOrGridContainer(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    try {
      const d = getComputedStyle(el).display;
      return (
        d === "flex" ||
        d === "inline-flex" ||
        d === "grid" ||
        d === "inline-grid"
      );
    } catch (_) {
      return false;
    }
  }

  function* iterWrapTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // An HTML <span> is invalid inside foreign-namespace content (SVG
        // <text>, MathML) — the browser silently renders nothing, blanking
        // e.g. chart legend labels.
        if (!n.parentElement || n.parentElement.namespaceURI !== HTML_NS)
          return NodeFilter.FILTER_REJECT;
        if (isInsideSkippedOrWrapped(n, root)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) yield n;
  }

  function wrapMentions(root, aliasMap) {
    const re = NT.resolve.buildAliasRegex(aliasMap);
    if (!re) return;
    const nodes = [...iterWrapTextNodes(root)];
    for (const node of nodes) {
      try {
        // React hydration can detach text nodes we collected. Skip those
        // rather than throwing — otherwise the rest of the loop is abandoned.
        if (!node.isConnected || !node.parentNode) continue;
        const text = node.nodeValue;
        re.lastIndex = 0;
        if (!re.test(text)) continue;
        re.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          const start = m.index;
          const end = start + m[0].length;
          if (start > lastIdx) {
            frag.appendChild(
              document.createTextNode(text.slice(lastIdx, start))
            );
          }
          const ent = aliasMap.get(m[1]);
          if (!ent) {
            frag.appendChild(document.createTextNode(m[0]));
          } else {
            const span = document.createElement("span");
            span.className = "nt-name";
            span.dataset.entity = ent.slug;
            span.textContent = m[0];
            frag.appendChild(span);
          }
          lastIdx = end;
        }
        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }
        const parent = node.parentNode;
        if (isFlexOrGridContainer(parent)) {
          const wrapper = document.createElement("span");
          wrapper.className = "nt-frag";
          wrapper.appendChild(frag);
          parent.replaceChild(wrapper, node);
        } else {
          parent.replaceChild(frag, node);
        }
      } catch (_) {
        // Defensive — one bad node should not abort the whole pass.
      }
    }
  }

  NT.wrap = { wrapMentions };
})();
