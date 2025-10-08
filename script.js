// ===== Shivneri Fresh - Search Helpers (script.js) =====

// Normalize text consistently
window.norm = (s = "") =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");

// ---- Brand aliases (final starting set) ----
window.BRAND_ALIASES = {
  "Golden Crown": ["gc", "golden crown"],
  "Lee Kum Kee": ["lkk", "lee kum kee"],
  "Quick Bite": ["qb", "quick bite"],
  "Woh Hup": ["wh", "woh hup"],
  "Amul": ["amul"],
  "Wingreens": ["wg", "wingreens", "wingreen"],
  "HyFun": ["hf", "hyfun"],
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

// ---- Keyword synonyms / fixes ----
window.KEYWORD_SYNONYMS = {
  "mozz": "mozzarella",
  "mayo": "mayonnaise",
  "ketchup": "tomato ketchup",
  "fries": "french fries",
  "soya": "soy",
  "olive": "olives",
  "oilves": "olives",
  "wraps": "wrap",
  "cordial": "juice"
};

// Detect brand from product name
window.detectBrandFromNameStart = function (nameRaw) {
  const t = window.norm(nameRaw).split(" ");
  const first = t[0] || "";
  const first2 = (t[0] || "") + " " + (t[1] || "");
  if (window.ALIAS_TO_BRAND[first2])
    return { brand: window.ALIAS_TO_BRAND[first2], consumedTokens: 2 };
  if (window.ALIAS_TO_BRAND[first])
    return { brand: window.ALIAS_TO_BRAND[first], consumedTokens: 1 };
  return { brand: null, consumedTokens: 0 };
};

// Expand code name like "GC Tomato Ketchup" → "Golden Crown Tomato Ketchup"
window.makeExpandedName = function (nameRaw, canonicalBrand, consumedTokens) {
  if (!canonicalBrand || !consumedTokens) return nameRaw;
  const rawTokens = String(nameRaw).split(/\s+/);
  const rest = rawTokens.slice(consumedTokens).join(" ");
  return rest ? `${canonicalBrand} ${rest}` : `${canonicalBrand}`;
};

// Parse user query: detect brand + rest
window.parseQueryForBrand = function (q) {
  const tokens = window.norm(q).split(" ").filter(Boolean);
  if (!tokens.length) return { brand: null, rest: "" };

  const t1 = tokens[0];
  const t2 = tokens[1] ? `${tokens[0]} ${tokens[1]}` : null;

  let brand = null, drop = 0;

  if (t2 && window.ALIAS_TO_BRAND[t2]) { brand = window.ALIAS_TO_BRAND[t2]; drop = 2; }
  else if (window.ALIAS_TO_BRAND[t1]) { brand = window.ALIAS_TO_BRAND[t1]; drop = 1; }

  if (!brand && window.BRAND_LOOKUP) {
    if (t2 && window.BRAND_LOOKUP[t2]) { brand = window.BRAND_LOOKUP[t2]; drop = 2; }
    else if (window.BRAND_LOOKUP[t1]) { brand = window.BRAND_LOOKUP[t1]; drop = 1; }
  }

  const restTokens = tokens.slice(drop);
  const expanded = restTokens.map(tok => window.KEYWORD_SYNONYMS[tok] || tok);

  return { brand, rest: expanded.join(" ").trim() };
};

// Fuse.js search setup
window.buildFuseForPool = function (pool) {
  return new Fuse(pool, {
    keys: ["nameSearch", "category"],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2
  });
};

// Rank + render results
window.rankAndRender = function (pool, queryText, brand) {
  if (!queryText && brand) {
    const top = pool
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10)
      .map(window.formatItemLine)
      .join("");
    window.addMessage(
      "bot",
      `
      <div class="reply-block">
        <div class="reply-note">
          <b>Brand:</b> ${window.escapeHTML(brand)} 
          <button class="chip-clear" data-clear-brand>✕</button>
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

  const tokens = window.norm(q).split(" ").filter(Boolean);
  const scored = raw
    .map((r) => {
      let bonus = 0;
      const hay = window.norm(r.item.nameSearch);
      tokens.forEach((t) => {
        if (!t) return;
        if (new RegExp(`\\b${t}\\b`, "i").test(r.item.nameSearch)) bonus += 0.15;
        if (hay.startsWith(t)) bonus += 0.1;
      });
      return { item: r.item, score: r.score - bonus };
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

// ===== Shivneri Fresh Chat Connection (Frontend to API) =====

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;

  addMessage("You", message);
  input.value = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (data.reply) {
      addMessage("Shivneri Bot", data.reply);
    } else {
      addMessage("Shivneri Bot", "Sorry, I didn’t get that.");
    }
  } catch (err) {
    console.error("Chat error:", err);
    addMessage("Shivneri Bot", "⚠️ Server error, please try again later.");
  }
});

function addMessage(sender, text) {
  const chatBox = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  msgDiv.className = sender === "You" ? "user-msg" : "bot-msg";
  msgDiv.innerHTML = `<b>${sender}:</b> ${text}`;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}
