window.NT = window.NT || {};

(function () {
  const WIKIPEDIA_SKIP = [
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
    "svg",
    "math",
  ].join(",");

  const DEFAULT_SKIP = [
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    // Headlines are typically title-cased — verbs like "Resigns" / "Says"
    // would otherwise be treated as name tokens.
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    "figure figcaption",
    ".caption",
    '[class*="caption" i]',
    '[class*="byline" i]',
    '[class*="related" i]',
    '[class*="recommend" i]',
    '[class*="newsletter" i]',
    '[class*="promo" i]',
    '[class*="share" i]',
    '[class*="social" i]',
    '[class*="comment" i]',
    '[class*="advert" i]',
    '[class*="sponsor" i]',
    "style",
    "script",
    "noscript",
    // Charts and formulas: their labels aren't prose, and wrapping text
    // inside foreign-namespace content breaks rendering (e.g. SVG legends).
    "svg",
    "math",
  ].join(",");

  function findGenericArticleBody() {
    const candidates = document.querySelectorAll(
      'article[role="article"], main article, article, main, [role="main"]'
    );
    let best = null;
    let bestCount = 0;
    for (const el of candidates) {
      const pCount = el.querySelectorAll("p").length;
      if (pCount > bestCount) {
        best = el;
        bestCount = pCount;
      }
    }
    return best;
  }

  const REGISTRY = [
    {
      match: (host) => /(^|\.)wikipedia\.org$/.test(host),
      config: {
        bodySelector: () =>
          document.querySelector("#mw-content-text .mw-parser-output") ||
          document.querySelector("#mw-content-text"),
        skipSelector: WIKIPEDIA_SKIP,
        castEnabled: true,
      },
    },
  ];

  const DEFAULT_CONFIG = {
    bodySelector: findGenericArticleBody,
    skipSelector: DEFAULT_SKIP,
    castEnabled: false,
  };

  function pickConfig() {
    const host = location.hostname || "";
    for (const entry of REGISTRY) {
      if (entry.match(host)) return entry.config;
    }
    return DEFAULT_CONFIG;
  }

  NT.site = { config: pickConfig() };
})();
