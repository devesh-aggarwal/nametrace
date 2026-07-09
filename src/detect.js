window.NT = window.NT || {};

(function () {
  const { MAX_NGRAM, STOPWORDS } = NT.constants;

  const SKIP_SELECTOR = NT.site.config.skipSelector;

  function getArticleBody() {
    const sel = NT.site.config.bodySelector;
    return typeof sel === "function" ? sel() : document.querySelector(sel);
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
  // Capture word-like tokens plus every non-whitespace character. Anything
  // that isn't a word-like token (comma, colon, em-dash, quote, paren, etc.)
  // should flush the capitalized run — capitalized words on either side of
  // those separators are unrelated entities.
  const WORD_OR_PUNCT_RE = /[\p{L}'’\-]+|\S/gu;
  const TRAILING_POSSESSIVE_RE = /['’]s?$/;

  const LOWER_WORD_RE = /^[a-z][\p{L}'’\-]*$/u;

  function harvestNgrams(root) {
    const counts = new Map();
    // Track lowercase forms of word-like tokens. If a token appears as a
    // regular lowercase word in the article body, it's a common noun
    // ("intelligence", "house", "council") — not a proper name. The alias
    // builder uses this to filter institutional entities like
    // "Central Intelligence" or "White House".
    const lowerCounts = new Map();
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
        // Strip trailing possessive: "Khalil's" → "Khalil", "Achilles'" → "Achilles".
        // Without this, "Mahmoud Khalil's" becomes a distinct multi-token ngram
        // and "Khalil's" / "Khalil" are counted as different surnames.
        const normalized = tok.replace(TRAILING_POSSESSIVE_RE, "");
        if (normalized && CAP_TOKEN_RE.test(normalized)) {
          run.push(normalized);
        } else if (tok === "." && /^[A-Z]$/.test(run[run.length - 1])) {
          // Middle-initial period, e.g. the "." in "Samuel L. Jackson" —
          // transparent to the run so it continues into the next
          // capitalized token(s) instead of splitting the name in two.
          // The period itself is not added to the run.
        } else {
          flush();
          if (
            normalized &&
            normalized.length >= 3 &&
            LOWER_WORD_RE.test(normalized)
          ) {
            lowerCounts.set(
              normalized,
              (lowerCounts.get(normalized) || 0) + 1
            );
          }
        }
      }
      flush();
    }
    return { counts, lowerCounts };
  }

  function topActivationCount(counts) {
    let topMulti = 0;
    for (const [ng, c] of counts) {
      if (!ng.includes(" ")) continue;
      const toks = ng.split(" ");
      if (toks.some((t) => STOPWORDS.has(t))) continue;
      if (c > topMulti) topMulti = c;
    }
    let topSingle = 0;
    for (const [ng, c] of counts) {
      if (ng.includes(" ")) continue;
      if (STOPWORDS.has(ng)) continue;
      if (c > topSingle) topSingle = c;
    }
    return Math.max(topMulti, topSingle);
  }

  NT.detect = {
    getArticleBody,
    iterTextNodes,
    harvestNgrams,
    topActivationCount,
    SKIP_SELECTOR,
  };
})();
