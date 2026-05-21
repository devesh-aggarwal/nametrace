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

  function* iterWrapTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
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
      node.parentNode.replaceChild(frag, node);
    }
  }

  NT.wrap = { wrapMentions };
})();
