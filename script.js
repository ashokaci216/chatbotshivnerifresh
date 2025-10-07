// ===== Shivneri Fresh - Search Helpers (script.js) =====

// Normalize text consistently
window.norm = (s = "") =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");

// ---- Brand aliases (final starting set) ----
// Only short codes and multi-word brands need aliases.
// Single-word brands (Amul, Disano, Canz...) will match naturally,
// but a few QoL spellings are included.
window.BRAND_ALIASES = {
  // Short-code brands
  "Golden Crown": ["gc", "golden crown"],

  // Multi-word brands with popular short forms
  "Lee Kum Kee": ["lkk", "lee kum kee"],
  "Quick Bite": ["qb", "quick bite"],
  "Woh Hup": ["wh", "woh hup"],

  // Common single-word brands (optional helpful aliases)
  "Amul": ["amul"],
  "Wingreens": ["wg", "wingreens", "wingreen"], // if you stock Wingreens
  "HyFun": ["hf", "hyfun"],                      // if you stock HyFun

  // Brands present in your sample list
  "Blue Bird": ["blue bird", "bluebird"],
  "Canz": ["canz"],
  "Disano": ["disano"],
  "Euro Gold": ["euro gold", "eurogold"],
  "Fresh2Go": ["fresh2go", "fresh 2 go", "fresh-2-go"]
};

// Reverse lookup for fast alias→brand
window.ALIAS_TO_BRAND = (() => {
  const m = {};
  for (const [brand, aliases] of Object.entries(window.BRAND_ALIASES)) {
    aliases.forEach((a) => (m[window.norm(a)] = brand));
  }
  return m;
})();

// ---- Keyword synonyms / fixes (helps fuzzy & typos) ----
window.KEYWORD_SYNONYMS = {
  "mozz": "mozzarella",
  "mayo": "mayonnaise",
  "ketchup": "tomato ketchup",
  "fries": "french fries",
  "soya": "soy",          // soya ↔ soy
  "olive": "olives",      // singular → plural
  "oilves": "olives",     // your data typo → olives
  "wraps": "wrap",
  "cordial": "juice"      // optional: lets "lime cordial" match "lime juice"
};

// Pull first 1–2 tokens from a name to guess brand by alias
window.detectBrandFromNameStart = function detectBrandFromNameStart(nameRaw) {
  const t = window.norm(nameRaw).split(" ");
  const first = t[0] || "";
  const first2 = (t[0] || "") + " " + (t[1] || "");
  // Try two-word alias first (e.g., "golden crown")
  if (window.ALIAS_TO_BRAND[first2])
    return { brand: window.ALIAS_TO_BRAND[first2], consumedTokens: 2 };
  if (window.ALIAS_TO_BRAND[first])
    return { brand: window.ALIAS_TO_BRAND[first], consumedTokens: 1 };
  return { brand: null, consumedTokens: 0 };
};

// Build an “expanded” name when item starts with a code (e.g., GC → Golden Crown)
window.makeExpandedName = function makeExpandedName(
  nameRaw,
  canonicalBrand,
  consumedTokens
) {
  if (!canonicalBrand || !consumedTokens) return nameRaw;
  const rawTokens = String(nameRaw).split(/\s+/);
  const rest = rawTokens.slice(consumedTokens).join(" ");
  return rest ? `${canonicalBrand} ${rest}` : `${canonicalBrand}`;
};

// Parse user query: detect brand first, return { brand, rest }
window.parseQueryForBrand = function parseQueryForBrand(q) {
  const tokens = window.norm(q).split(" ").filter(Boolean);
  if (!tokens.length) return { brand: null, rest: "" };

  const t1 = tokens[0];
  const t2 = tokens[1] ? `${tokens[0]} ${tokens[1]}` : null;

  let brand = null, drop = 0;

  // 1) Try alias map (codes & multi-word brand names)
  if (t2 && window.ALIAS_TO_BRAND[t2]) { brand = window.ALIAS_TO_BRAND[t2]; drop = 2; }
  else if (window.ALIAS_TO_BRAND[t1])   { brand = window.ALIAS_TO_BRAND[t1]; drop = 1; }

  // 2) Fallback to dynamic brand lookup from catalog (handles single-word brands like "Nandini")
  if (!brand && window.BRAND_LOOKUP) {
    if (t2 && window.BRAND_LOOKUP[t2]) { brand = window.BRAND_LOOKUP[t2]; drop = 2; }
    else if (window.BRAND_LOOKUP[t1])   { brand = window.BRAND_LOOKUP[t1]; drop = 1; }
  }

  const restTokens = tokens.slice(drop);
  const expanded = restTokens.map(tok => window.KEYWORD_SYNONYMS[tok] || tok);

  return { brand, rest: expanded.join(" ").trim() };
};

// Build a Fuse index for a given product pool
window.buildFuseForPool = function buildFuseForPool(pool) {
  return new Fuse(pool, {
    keys: ["nameSearch", "category"],
    threshold: 0.35, // tighter = fewer wild matches
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2
  });
};

// Rank + render (expects formatItemLine + addMessage + botText in app.js)
window.rankAndRender = function rankAndRender(pool, queryText, brand) {
  // If no keywords and brand is set: show top items of that brand (by name)
  if (!queryText && brand) {
    const top = pool
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10)
      .map(window.formatItemLine) // defined in app.js
      .join("");
    window.addMessage(
      "bot",
      `
      <div class="reply-block">
        <div class="reply-note">
          <b>Brand:</b> ${window.escapeHTML(brand)} <button class="chip-clear" data-clear-brand>✕</button>
        </div>
        ${top}
        <div class="reply-note">Would you like to add any of these to your cart?</div>
      </div>
    `
    );
    return;
  }

  const fuse = window.buildFuseForPool(pool);
  const q = queryText || "";
  const raw = fuse.search(q);

  // Add small bonuses for starts-with / whole word matches
  const tokens = window.norm(q).split(" ").filter(Boolean);
  const scored = raw
    .map((r) => {
      let bonus = 0;
      const hay = window.norm(r.item.nameSearch);
      tokens.forEach((t) => {
        if (!t) return;
        if (new RegExp(`\\b${t}\\b`, "i").test(r.item.nameSearch)) bonus += 0.15; // whole word
        if (hay.startsWith(t)) bonus += 0.1; // starts with
      });
      return { item: r.item, score: r.score - bonus }; // lower is better
    })
    .sort((a, b) => a.score - b.score);

  const top = (scored.length ? scored : raw)
    .slice(0, 10)
    .map((x) => window.formatItemLine(x.item))
    .join("");

  const brandChip = brand
    ? `<div class="reply-note"><b>Brand:</b> ${window.escapeHTML(
        brand
      )} <button class="chip-clear" data-clear-brand>✕</button></div>`
    : "";

  if (top) {
    window.addMessage(
      "bot",
      `
      <div class="reply-block">
        ${brandChip}
        ${top}
        <div class="reply-note">Would you like to add any of these to your cart?</div>
      </div>
    `
    );
  } else {
    const label = queryText ? `“${window.escapeHTML(queryText)}”` : "your query";
    const brandMsg = brand ? ` under ${window.escapeHTML(brand)}` : "";
    window.botText(`No results for ${label}${brandMsg}. Try another keyword or clear the brand filter.`);
  }
};
