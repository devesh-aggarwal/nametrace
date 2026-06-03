# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**NameTrace** is a Chrome (Manifest V3) browser extension. On article-shaped
pages it detects person names, wraps each mention in an invisible span, and
shows a hover tooltip with the person's full canonical name and the sentence
where they were first introduced. It runs entirely as a set of content scripts
injected into the page — there is **no background/service worker, no popup, and
no options page**.

The user-facing overview, install steps, and a prose description of the
detection pipeline live in `README.md`. Keep `README.md` and this file in sync
when the architecture changes.

## Tech stack & build

- **Vanilla JavaScript only.** No framework, no bundler, no transpiler.
- **No build step, no `package.json`, no dependencies, no lockfile.** The files
  in `src/` and `styles/` are shipped to the browser exactly as written.
- **No automated tests or linters.** Verification is manual (see below).

Because there is no build, do **not** introduce `import`/`export`, JSX,
TypeScript, or npm packages without a deliberate decision to add tooling — it
would break the load model described below.

## Architecture & conventions

### Global namespace, ordered script loading

Every module attaches to a single global object, `window.NT`, instead of using
ES modules:

```js
window.NT = window.NT || {};
NT.detect = { ... };   // each file exposes one sub-object
```

The scripts are loaded in a **fixed order** declared in
`manifest.json → content_scripts[0].js`. A module may only use `NT.*` members
defined by a script listed *before* it. The current order is:

```
constants.js → site.js → detect.js → cast.js → resolve.js → wrap.js → tooltip.js → content.js
```

When you add a new module: create `src/<name>.js`, wrap its body in an IIFE,
expose `NT.<name>`, and **add it to the `js` array in `manifest.json` at the
correct position** relative to its dependencies. Forgetting the manifest entry
means the file simply never loads.

### Pipeline (orchestrated by `content.js → run()`)

1. `NT.detect.getArticleBody()` — find the article body via the per-host config.
2. `NT.detect.harvestNgrams()` — count capitalized n-grams + lowercase token
   frequencies.
3. **Activation gate** — bail if no phrase reaches `ACTIVATION_MIN_OCCURRENCES`.
4. `NT.cast.harvestCast()` — Wikipedia-only cast/character table extraction
   (no-op elsewhere).
5. `NT.resolve.build()` — promote n-grams to entities (3 paths: direct,
   news-surname, single-token), build an alias map, drop ambiguous aliases.
6. `NT.resolve.captureFirstMentions()` — record each entity's first-mention
   sentence.
7. `NT.tooltip.install()` — attach the single floating tooltip + hover handlers.
8. `NT.wrap.wrapMentions()` — wrap occurrences in `<span class="nt-name">`.
9. `observeForLateRenders()` — a debounced `MutationObserver` re-runs the wrap
   step as client-rendered (React/Vue) content hydrates, capped at
   `REWRAP_MAX_PASSES`.

### Key invariants — preserve these

- **`wrapMentions` must stay idempotent.** It skips text already inside
  `.nt-name` spans so the MutationObserver can re-run it safely. Don't add logic
  that double-wraps or that mutates outside the article body.
- **`.nt-name` has no visible styling** (see `styles/tooltip.css`) — wrapped
  names must look identical to surrounding text.
- **Wrapping/observer code is defensively wrapped in `try/catch`** because React
  hydration can detach nodes mid-pass. Keep individual node failures from
  aborting a whole pass.
- **All tuning lives in `src/constants.js`** (thresholds, stopwords, timing).
  Add new tunable values there as named constants rather than inline magic
  numbers.

### File map

```
manifest.json     MV3 manifest; defines content-script load order + version
src/
  constants.js    thresholds, STOPWORDS, timing/pacing knobs
  site.js         per-host config registry (Wikipedia vs. generic default)
  detect.js       article-body finder, n-gram harvest, activation gate
  cast.js         Wikipedia cast/characters parser (no-op on other sites)
  resolve.js      entity build, alias map, sentence segmentation/abbreviations
  wrap.js         TreeWalker DOM wrapping (idempotent)
  tooltip.js      single floating tooltip: render, position, hover delays
  content.js      entry point: orchestrates pipeline + MutationObserver
styles/
  tooltip.css     tooltip styling; .nt-name is intentionally invisible
icons/            16/48/128 px extension icons
```

## Development workflow

1. Edit files under `src/` / `styles/` directly.
2. Load the extension: `chrome://extensions/` → enable **Developer mode** →
   **Load unpacked** → select this folder.
3. After any edit, click the **reload** icon on the extension card, then reload
   the test page.
4. Test against a spread of page types: a Wikipedia article (cast tables), a
   news article (surname reuse), and a client-rendered/SPA site (late renders).

### Debugging

Run `localStorage.setItem("NT_DEBUG", "1")` in the page's DevTools console and
reload. Debug mode exposes the resolved alias list on `<html data-nt-aliases>`
and a `__nt-force-rewrap` custom event to trigger a manual wrap pass. It is off
by default and should stay off in shipped behavior.

## Versioning & commits

- The extension version lives **only** in `manifest.json` (`"version"`).
- Existing convention: user-facing changes are followed by a separate commit
  titled **"Increment version number"** that bumps `manifest.json`. Follow this
  when shipping behavior changes.
- Commit messages are short, imperative, and capitalized (e.g. "Fix sentence
  detection splitting on abbreviations", "Update README").

## Notes for assistants

- Prefer extending `STOPWORDS` / adjusting constants over special-casing logic
  when fixing false positives — the detection heuristics are frequency-based by
  design.
- This file (`CLAUDE.md`) was previously listed in `.gitignore`; it has been
  un-ignored so it can be tracked. Leave it tracked.
