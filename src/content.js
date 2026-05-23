(function () {
  // Version stamp so the page world can verify which build is running.
  // Bump this whenever content.js changes meaningfully.
  document.documentElement.setAttribute("data-nt-build", "2026-05-22-single-token-v8");

  function observeForLateRenders(body, aliasMap) {
    const fullRewrap = () => {
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
      clearTimeout(rewrapTimer);
      rewrapTimer = setTimeout(fullRewrap, 300);
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
    setTimeout(fullRewrap, 500);
    setTimeout(fullRewrap, 2000);
    setTimeout(fullRewrap, 5000);
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

    // Debug exposure: expose alias keys and a manual rewrap trigger so the
    // page world can interrogate without context-switching DevTools.
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
