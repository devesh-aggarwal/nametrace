(function () {
  // Debug toggle: opt-in via `localStorage.setItem("NT_DEBUG", "1")`.
  // When on, the extension exposes diagnostic state on <html> and a custom
  // event listener that the page world can use to introspect and trigger
  // a manual re-wrap. Off by default to avoid leaking entity lists and
  // exposing a re-wrap event handler to arbitrary pages.
  const DEBUG = (() => {
    try {
      return localStorage.getItem("NT_DEBUG") === "1";
    } catch (_) {
      return false;
    }
  })();
  const BUILD_TAG = "nametrace-content-script";

  function observeForLateRenders(body, aliasMap) {
    const {
      REWRAP_DEBOUNCE_MS,
      REWRAP_SAFETY_DELAYS_MS,
      REWRAP_MAX_PASSES,
    } = NT.constants;

    let rewrapPasses = 0;
    let observerDisconnected = false;

    const fullRewrap = () => {
      if (rewrapPasses >= REWRAP_MAX_PASSES) {
        if (!observerDisconnected) {
          obs.disconnect();
          observerDisconnected = true;
        }
        return;
      }
      rewrapPasses++;
      try {
        const cur = NT.detect.getArticleBody() || body;
        if (cur) NT.wrap.wrapMentions(cur, aliasMap);
      } catch (_) {}
    };

    // Any mutation under the document body triggers a debounced full re-wrap
    // of the article body. The wrap function is idempotent — it skips text
    // already inside .nt-name spans — so re-running is safe. This catches
    // arbitrary React render patterns (text-node additions, characterData
    // changes, element re-mounts) without needing to enumerate them.
    let rewrapTimer = null;
    const scheduleRewrap = () => {
      if (observerDisconnected || rewrapPasses >= REWRAP_MAX_PASSES) return;
      clearTimeout(rewrapTimer);
      rewrapTimer = setTimeout(fullRewrap, REWRAP_DEBOUNCE_MS);
    };
    const obs = new MutationObserver((mutations) => {
      // Cheap filter: ignore mutations that are entirely self-caused
      // (only nt-name spans added/removed).
      for (const m of mutations) {
        if (m.type === "characterData") {
          scheduleRewrap();
          return;
        }
        for (const node of m.addedNodes) {
          if (
            node.nodeType === 1 &&
            node.classList &&
            node.classList.contains("nt-name")
          ) {
            continue;
          }
          scheduleRewrap();
          return;
        }
      }
    });
    obs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    // Belt-and-suspenders: scheduled re-wraps in case mutations fire before
    // the initial run completes, or stop firing before the page is stable.
    for (const delay of REWRAP_SAFETY_DELAYS_MS) {
      setTimeout(fullRewrap, delay);
    }
  }

  function run() {
    const body = NT.detect.getArticleBody();
    if (!body) return;

    const { counts, lowerCounts } = NT.detect.harvestNgrams(body);

    const top = NT.detect.topActivationCount(counts);
    const activationMin =
      NT.site.config.activationMin ?? NT.constants.ACTIVATION_MIN_OCCURRENCES;
    if (top < activationMin) return;

    const castNames = NT.cast.harvestCast();
    const { entities, aliasMap } = NT.resolve.build(
      castNames,
      counts,
      lowerCounts
    );
    if (aliasMap.size === 0 || entities.size === 0) return;

    NT.resolve.captureFirstMentions(body, entities, aliasMap);

    const entityBySlug = new Map();
    for (const ent of entities.values()) entityBySlug.set(ent.slug, ent);
    NT.tooltip.install(body, entityBySlug);

    // Attach observer BEFORE the initial wrap so React hydration mid-wrap
    // can't prevent late renders from being wrapped later.
    observeForLateRenders(body, aliasMap);

    try {
      NT.wrap.wrapMentions(body, aliasMap);
    } catch (_) {}

    if (DEBUG) {
      document.documentElement.setAttribute("data-nt-build", BUILD_TAG);
      document.documentElement.setAttribute(
        "data-nt-aliases",
        JSON.stringify([...aliasMap.keys()])
      );
      document.addEventListener("__nt-force-rewrap", () => {
        try {
          const cur = NT.detect.getArticleBody() || body;
          const before = document.querySelectorAll("span.nt-name").length;
          NT.wrap.wrapMentions(cur, aliasMap);
          const after = document.querySelectorAll("span.nt-name").length;
          document.documentElement.setAttribute(
            "data-nt-force-result",
            JSON.stringify({ before, after, bodyTag: cur && cur.tagName })
          );
        } catch (e) {
          document.documentElement.setAttribute(
            "data-nt-force-result",
            "error: " + e.message
          );
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
