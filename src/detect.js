window.NT = window.NT || {};

(function () {
  const { MAX_NGRAM, STOPWORDS } = NT.constants;

  const SKIP_SELECTOR = [
    "table",
    ".infobox",
    ".navbox",
    ".sidebar",
    ".reference",
    ".references",
    ".reflist",
    ".mw-editsection",
    ".hatnote",
    ".thumb",
    ".thumbcaption",
    ".mw-empty-elt",
    ".navigation-not-searchable",
    "sup.reference",
    "style",
    "script",
    ".toc",
    "#toc",
    ".mw-jump-link",
    ".plainlinks",
    ".metadata",
  ].join(",");

  function getArticleBody() {
    return (
      document.querySelector("#mw-content-text .mw-parser-output") ||
      document.querySelector("#mw-content-text")
    );
  }

  function isSkipped(node, root) {
    let p = node.parentElement;
    while (p && p !== root) {
      if (p.matches && p.matches(SKIP_SELECTOR)) return true;
      p = p.parentElement;
    }
    return false;
  }

  function* iterTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isSkipped(n, root)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) yield n;
  }

  const CAP_TOKEN_RE = /^[A-Z][\p{L}'’\-]*$/u;
  const WORD_OR_PUNCT_RE = /[\p{L}'’\-]+|[.!?]/gu;

  function harvestNgrams(root) {
    const counts = new Map();
    for (const node of iterTextNodes(root)) {
      const text = node.nodeValue;
      const tokens = text.match(WORD_OR_PUNCT_RE) || [];

      let run = [];
      const flush = () => {
        if (run.length === 0) return;
        const len = Math.min(MAX_NGRAM, run.length);
        for (let n = 1; n <= len; n++) {
          for (let s = 0; s + n <= run.length; s++) {
            const ng = run.slice(s, s + n).join(" ");
            if (n === 1 && STOPWORDS.has(run[s])) continue;
            counts.set(ng, (counts.get(ng) || 0) + 1);
          }
        }
        run = [];
      };

      for (const tok of tokens) {
        if (/^[.!?]$/.test(tok)) {
          flush();
          continue;
        }
        if (CAP_TOKEN_RE.test(tok)) {
          run.push(tok);
        } else {
          flush();
        }
      }
      flush();
    }
    return counts;
  }

  function topActivationCount(counts) {
    let top = 0;
    for (const [ng, c] of counts) {
      if (!ng.includes(" ")) continue;
      const toks = ng.split(" ");
      if (toks.some((t) => STOPWORDS.has(t))) continue;
      if (c > top) top = c;
    }
    if (top === 0) {
      for (const [ng, c] of counts) {
        if (ng.includes(" ")) continue;
        if (STOPWORDS.has(ng)) continue;
        if (c > top) top = c;
      }
    }
    return top;
  }

  NT.detect = {
    getArticleBody,
    iterTextNodes,
    harvestNgrams,
    topActivationCount,
    SKIP_SELECTOR,
  };
})();
