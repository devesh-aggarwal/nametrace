(function () {
  function run() {
    const body = NT.detect.getArticleBody();
    if (!body) return;

    const counts = NT.detect.harvestNgrams(body);

    const top = NT.detect.topActivationCount(counts);
    if (top < NT.constants.ACTIVATION_MIN_OCCURRENCES) return;

    const castNames = NT.cast.harvestCast();
    const { entities, aliasMap } = NT.resolve.build(castNames, counts);
    if (aliasMap.size === 0 || entities.size === 0) return;

    NT.resolve.captureFirstMentions(body, entities, aliasMap);
    NT.wrap.wrapMentions(body, aliasMap);

    const entityBySlug = new Map();
    for (const ent of entities.values()) entityBySlug.set(ent.slug, ent);
    NT.tooltip.install(body, entityBySlug);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
