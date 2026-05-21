# NameTrace

Wikipedia summaries (movie plots, novel synopses, episode recaps, biographies) routinely flip between first names, last names, and full names of the same person. A character may be introduced with just a first name in paragraph 1 and only get a last name five paragraphs later, forcing readers to scroll back or lose track. 

This extension fixes that without disrupting the reading experience. On any Wikipedia page with a dense cluster of name mentions, hovering a name reveals (a) the full name and (b) the original sentence where the person was first introduced.

## Developer Install (unpacked)

1. Open `chrome://extensions/` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this folder (`nametrace`).
4. Open any Wikipedia article with a dense cluster of name mentions and hover.

## How it works

1. **Activation gate** — counts capitalized phrases in the article body; activates only if at least one entity appears five or more times.
2. **Cast harvest** — if the page has a Cast / Characters section, pulls canonical names from it.
3. **Capitalized-token fallback** — also harvests multi-word capitalized phrases from the article body that appear at least three times.
4. **Coreference** — links bare first names and last names to the full canonical (the "Ellen → Ellen Ripley" problem). Ambiguous bare names (two characters share a first name) are left unwrapped.
5. **First-mention sentence** — for each entity, records the sentence where any of its aliases first appears.
6. **DOM wrapping** — wraps each detected name occurrence in an invisible `<span class="nt-name">`. A single floating tooltip element handles hover for the whole page.

## File layout

```
manifest.json
src/
  constants.js   thresholds, stopwords, section-heading regex
  detect.js      article body, text-node iteration, n-gram harvest, activation gate
  cast.js        cast/characters section parser (tables + lists)
  resolve.js     entity build, alias map, ambiguity drop, first-mention capture
  wrap.js        TreeWalker DOM wrapping of name occurrences
  tooltip.js     single-tooltip render, positioning, hover delays
  content.js     entry point — orchestrates the pipeline
styles/
  tooltip.css    tooltip styling only; .nt-name has no visible treatment
```

## Tuning

Constants in `src/constants.js`:

- `ACTIVATION_MIN_OCCURRENCES` (default 5) — frequency required to activate on a page.
- `FALLBACK_MIN_OCCURRENCES` (default 3) — frequency required to promote a non-cast multi-word phrase to an entity.
- `MAX_NGRAM` (default 3) — longest capitalized run considered as a name.
- `STOPWORDS` — common words / honorifics / place names that should never be treated as names.
