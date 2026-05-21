window.NT = window.NT || {};

(function () {
  const { FALLBACK_MIN_OCCURRENCES, STOPWORDS } = NT.constants;

  const NAME_TOKEN_RE = /^[A-Z][\p{L}'’\-]*$/u;

  function slugify(s) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isQualifiedName(name) {
    const toks = name.split(/\s+/);
    if (toks.length === 0) return false;
    if (toks.some((t) => STOPWORDS.has(t))) return false;
    return toks.every((t) => NAME_TOKEN_RE.test(t));
  }

  function build(castNames, ngramCounts) {
    const entities = new Map(); // slug -> entity

    const ensureEntity = (canonical) => {
      const s = slugify(canonical);
      let ent = entities.get(s);
      if (!ent) {
        ent = {
          canonical,
          slug: s,
          aliases: new Set(),
          firstSentence: null,
          fromCast: false,
        };
        entities.set(s, ent);
      }
      return ent;
    };

    // Seed with cast names (highest confidence)
    for (const name of castNames) {
      if (!isQualifiedName(name)) continue;
      const ent = ensureEntity(name);
      ent.fromCast = true;
    }

    // Promote multi-token ngrams with sufficient frequency
    const candidates = [];
    for (const [ng, c] of ngramCounts) {
      if (!ng.includes(" ")) continue;
      if (c < FALLBACK_MIN_OCCURRENCES) continue;
      if (!isQualifiedName(ng)) continue;
      candidates.push({ ng, c });
    }
    candidates.sort((a, b) => b.ng.length - a.ng.length);

    for (const { ng } of candidates) {
      let merged = false;
      for (const ent of [...entities.values()]) {
        if (ent.canonical === ng) {
          merged = true;
          break;
        }
        if (ent.canonical.includes(ng)) {
          // existing canonical is longer — keep it
          merged = true;
          break;
        }
        if (ng.includes(ent.canonical)) {
          // new candidate is longer — replace, unless existing came from cast
          if (!ent.fromCast) {
            entities.delete(ent.slug);
            ensureEntity(ng);
          }
          merged = true;
          break;
        }
      }
      if (!merged) ensureEntity(ng);
    }

    // Generate aliases for each entity: full name + each token + adjacent 2-token spans
    for (const ent of entities.values()) {
      ent.aliases.add(ent.canonical);
      const toks = ent.canonical.split(/\s+/);
      for (const t of toks) {
        if (STOPWORDS.has(t)) continue;
        if (t.length < 3) continue;
        ent.aliases.add(t);
      }
      if (toks.length >= 3) {
        for (let i = 0; i + 2 <= toks.length; i++) {
          const sub = toks.slice(i, i + 2).join(" ");
          ent.aliases.add(sub);
        }
      }
    }

    // Build alias -> owners, then drop ambiguous ones
    const aliasOwners = new Map();
    for (const ent of entities.values()) {
      for (const a of ent.aliases) {
        let set = aliasOwners.get(a);
        if (!set) {
          set = new Set();
          aliasOwners.set(a, set);
        }
        set.add(ent.slug);
      }
    }
    const aliasMap = new Map();
    for (const [alias, owners] of aliasOwners) {
      if (owners.size === 1) {
        const s = [...owners][0];
        aliasMap.set(alias, entities.get(s));
      }
    }

    return { entities, aliasMap };
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildAliasRegex(aliasMap) {
    const aliases = [...aliasMap.keys()].sort((a, b) => b.length - a.length);
    if (aliases.length === 0) return null;
    const alt = aliases.map(escapeRegex).join("|");
    return new RegExp(`(?<![\\p{L}\\d])(${alt})(?![\\p{L}\\d])`, "gu");
  }

  function captureFirstMentions(root, entities, aliasMap) {
    const re = buildAliasRegex(aliasMap);
    if (!re) return;
    const segmenter =
      typeof Intl !== "undefined" && "Segmenter" in Intl
        ? new Intl.Segmenter("en", { granularity: "sentence" })
        : null;

    const paragraphs = root.querySelectorAll("p");
    const seen = new Set();
    for (const p of paragraphs) {
      if (seen.size === entities.size) break;
      const text = (p.textContent || "").trim();
      if (!text) continue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;

      let sentences;
      if (segmenter) {
        sentences = [...segmenter.segment(text)].map((s) => s.segment);
      } else {
        sentences = text.split(/(?<=[.!?])\s+/);
      }
      for (const sent of sentences) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(sent)) !== null) {
          const ent = aliasMap.get(m[1]);
          if (ent && !ent.firstSentence) {
            ent.firstSentence = sent.trim();
            seen.add(ent.slug);
          }
        }
      }
    }
  }

  NT.resolve = { build, captureFirstMentions, buildAliasRegex };
})();
