# NameTrace

Long-form articles (e.g., Wikipedia plots, news stories, and blog posts) routinely flip between first names, last names, and full names of the same person. A politician introduced as *Chuck Schumer* in paragraph one is just *Schumer* for the rest of the piece. A novel synopsis names *Ellen Ripley* once, then five paragraphs of *Ellen* and *Ripley* in alternation. Readers either scroll back or lose track.

NameTrace fixes that without disrupting the reading experience. On any article-shaped page with a dense cluster of name mentions, hovering a name reveals (a) the full canonical name and (b) the original sentence where the person was first introduced.

## Install

**From the Chrome Web Store:** <https://chromewebstore.google.com/detail/nametrace/oghjmnlknfopibjcjeceobnpbcdobpep>

**Unpacked, for development:**

1. Open `chrome://extensions/` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this folder (`nametrace`).
4. Open any long-form article with a dense cluster of name mentions and hover.

## Where it runs

Out of the box, NameTrace activates on any web page — Wikipedia articles, news sites (NYT, WSJ, BBC, Guardian, AP, Reuters, etc.), Substack, Medium, and long-form blogs. Wikipedia gets the richer treatment (cast/character table harvesting); every other site falls back to a generic article-body finder (`<article>` / `<main>`) and pure n-gram name detection. Pages without article-shaped content (homepages, search results, GitHub repos) bail fast and don't wrap anything.

## How it works

1. **Site config** — picks an article-body selector and skip list based on the host (`*.wikipedia.org` gets the MediaWiki-specific config; everything else gets a generic `article`/`main` picker).
2. **N-gram harvest** — walks the article body, counts capitalized n-grams, and also tracks how often each token appears as a regular lowercase word (used to filter common nouns).
3. **Activation gate** — bails on pages where no capitalized phrase reaches the activation threshold.
4. **Cast harvest** — Wikipedia only: pulls canonical names from Cast / Characters tables and "as <Name>" lists.
5. **Entity resolution** — promotes multi-token n-grams to entities via three paths:
   - *Direct* — the phrase itself repeats often (`>= FALLBACK_MIN_OCCURRENCES`).
   - *News-path* — the phrase appears once but its surname is reused frequently (covers `"Joe Biden"` introduced once with `"Biden"` thereafter).
   - *Single-token* — high-frequency standalone surnames where no full-name n-gram exists (covers articles that only ever say `"Trump"`).
   Filters out institutional terms (`"Central Intelligence"`, `"White House"`) and title-case headline phrases (`"Broke With Trump"`).
6. **First-mention capture** — for each entity, records the sentence where any of its aliases first appears.
7. **DOM wrapping** — wraps each detected name occurrence in an invisible `<span class="nt-name">`. A single floating tooltip handles hover for the whole page.
8. **Late-render observer** — for client-rendered sites (React, Vue, etc.), a debounced `MutationObserver` re-runs the wrap step as content hydrates in, capped to a finite number of passes per page.

## File layout

```
manifest.json
src/
  constants.js   thresholds, stopwords, tuning knobs
  site.js        per-host config registry (Wikipedia vs. default)
  detect.js      article body, n-gram harvest, lowercase tracking, activation gate
  cast.js        Wikipedia cast/characters parser (no-op elsewhere)
  resolve.js     entity build (3 promotion paths), alias map, ambiguity drop
  wrap.js        TreeWalker DOM wrapping of name occurrences
  tooltip.js     single-tooltip render, positioning, hover delays
  content.js     entry point — orchestrates the pipeline + MutationObserver
styles/
  tooltip.css    tooltip styling; .nt-name has no visible treatment
```

## Tuning

See `src/constants.js` for the full list. Key knobs:

- `ACTIVATION_MIN_OCCURRENCES` (5) — frequency required to activate on a page.
- `FALLBACK_MIN_OCCURRENCES` (3) — repetitions required for direct-path entity promotion.
- `NEWS_SURNAME_MIN_OCCURRENCES` (2) — surname reuses required for news-path promotion.
- `SINGLE_TOKEN_MIN_OCCURRENCES` (5) — count required for single-token entity promotion.
- `LOWER_COMMON_NOUN_MIN` (2) — lowercase occurrences that flag a token as a common noun.
- `REWRAP_MAX_PASSES` (30) — upper bound on MutationObserver-triggered re-wraps.
- `STOPWORDS` — words never treated as names (common verbs, prepositions, institutional terms, honorifics).

## Debug mode

Run `localStorage.setItem("NT_DEBUG", "1")` in DevTools on the page and reload. With debug on, the extension exposes the resolved alias list on `<html data-nt-aliases>` and a `__nt-force-rewrap` event for manually triggering a wrap pass. Off by default.
