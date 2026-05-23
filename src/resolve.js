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

  function build(castNames, ngramCounts, lowerCounts) {
    const entities = new Map(); // slug -> entity
    const LOWER_COMMON_NOUN_MIN = 2; // appears as lowercase word at least N times → common noun

    const isCommonNounComposite = (ng) => {
      if (!lowerCounts) return false;
      const toks = ng.split(" ");
      for (const t of toks) {
        const lower = t.toLowerCase();
        if ((lowerCounts.get(lower) || 0) >= LOWER_COMMON_NOUN_MIN) {
          return true;
        }
      }
      return false;
    };

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

    // Promote multi-token ngrams that look like full names.
    // Wikipedia case: the full name itself repeats (c >= FALLBACK_MIN_OCCURRENCES).
    // News case: the full name appears once at intro, but the last token (surname)
    // repeats often as a standalone capitalized token. Group these candidates by
    // surname and keep only the best one — otherwise random capitalized runs ending
    // in a frequent surname all become entities and the surname alias gets dropped
    // as ambiguous.
    const candidates = [];
    const newsBySurname = new Map();
    for (const [ng, c] of ngramCounts) {
      if (!ng.includes(" ")) continue;
      if (!isQualifiedName(ng)) continue;
      // Drop institutional / common-noun composites — any token that also
      // appears as a regular lowercase word in the body is not a name.
      if (isCommonNounComposite(ng)) continue;
      if (c >= FALLBACK_MIN_OCCURRENCES) {
        candidates.push({ ng, c });
        continue;
      }
      const toks = ng.split(" ");
      const last = toks[toks.length - 1];
      if (last.length < 3 || STOPWORDS.has(last)) continue;
      const lastCount = ngramCounts.get(last) || 0;
      // News-path threshold is lower than direct-path because we only need
      // ONE reuse of the surname to justify wiring up the tooltip — e.g.
      // "Zach Kahler" introduced once, then "Mr. Kahler" mentioned twice.
      if (lastCount < 2) continue;
      // Reject ngrams where a non-last token appears standalone far more
      // often than the full phrase itself. A real first name tokenizes
      // adjacent to the surname; "National" / "Intelligence" / etc. show
      // up in many other capitalized contexts and would create spurious
      // "X Y Surname" entities that compete with the real "First Surname".
      let spurious = false;
      for (let i = 0; i < toks.length - 1; i++) {
        const tCount = ngramCounts.get(toks[i]) || 0;
        if (tCount > c * 2 && tCount >= FALLBACK_MIN_OCCURRENCES) {
          spurious = true;
          break;
        }
      }
      if (spurious) continue;
      const existing = newsBySurname.get(last);
      const better =
        !existing ||
        c > existing.c ||
        (c === existing.c && ng.length > existing.ng.length);
      if (better) newsBySurname.set(last, { ng, c });
    }
    for (const { ng, c } of newsBySurname.values()) {
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

    // Promote high-frequency standalone capitalized tokens as single-token
    // entities. Covers articles that only refer to a person by surname
    // because the full name never appears (e.g. "Trump" / "President Trump"
    // where "President" is filtered as a stopword). Only promote if no
    // existing entity already claims this token as part of its canonical.
    const SINGLE_TOKEN_MIN = 5;
    const claimedTokens = new Set();
    for (const ent of entities.values()) {
      for (const t of ent.canonical.split(/\s+/)) {
        if (t.length >= 3 && !STOPWORDS.has(t)) claimedTokens.add(t);
      }
    }
    for (const [ng, c] of ngramCounts) {
      if (ng.includes(" ")) continue;
      if (c < SINGLE_TOKEN_MIN) continue;
      if (ng.length < 3) continue;
      if (STOPWORDS.has(ng)) continue;
      if (!NAME_TOKEN_RE.test(ng)) continue;
      if (claimedTokens.has(ng)) continue;
      if (
        lowerCounts &&
        (lowerCounts.get(ng.toLowerCase()) || 0) >= LOWER_COMMON_NOUN_MIN
      ) {
        continue;
      }
      ensureEntity(ng);
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
