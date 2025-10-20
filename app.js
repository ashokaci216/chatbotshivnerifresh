// ===== Shivneri Fresh Customer Support Chat (Frontend + Backend API) =====

// ---- Config ----
const WHATSAPP_NUMBER = "919867378209"; // +91 9867378209

// ---- State ----
let products = [];
let fuse;
let cart = JSON.parse(localStorage.getItem("sf_cart") || "[]");

// ---- DOM Refs ----
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const messages = document.getElementById("messages");
const clearBtn = document.getElementById("clear-chat");
const shortcuts = document.getElementById("shortcuts");

const cartCountEl = document.getElementById("cart-count");
const cartTotalEl = document.getElementById("cart-total");
const whatsappBtn = document.getElementById("whatsapp-checkout");
const clearCartBtn = document.getElementById("clear-cart");
const checkoutInfo = document.querySelector("#checkout-bar .cart-info");

// Mini-cart (drawer)
const mini = document.getElementById("mini-cart");
const miniLines = document.getElementById("mini-lines");
const miniTotal = document.getElementById("mini-total");
const miniClose = document.getElementById("mini-close");
const miniWA = document.getElementById("mini-wa");

// ---- Utilities ----
const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const fmtINR = (n) => `₹${INR.format(Number(n || 0))}`;

function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[s]));
}

function saveCart() {
  localStorage.setItem("sf_cart", JSON.stringify(cart));
  updateCheckoutBar();
}

function cartCount() {
  return cart.reduce((sum, i) => sum + (Number(i.qty) || 1), 0);
}

function cartTotal() {
  return cart.reduce((sum, i) => {
    const price = Number(i.price) || 0;
    const qty = Number(i.qty) || 1;
    return sum + price * qty;
  }, 0);
}

function updateCheckoutBar() {
  const count = cartCount();
  const total = cartTotal();
  if (cartCountEl) cartCountEl.textContent = String(count);
  if (cartTotalEl) cartTotalEl.textContent = fmtINR(total);
  if (whatsappBtn) whatsappBtn.disabled = count === 0;
  if (clearCartBtn) clearCartBtn.style.display = count ? "inline-flex" : "none";
}

function showClearIfNeeded() {
  if (messages.children.length >= 2) clearBtn.classList.remove("hidden");
}

// ---- Tips ----
const CATEGORY_TIPS = {
  CHEESE: "Good for pizza, pasta, or sandwiches.",
  MOZZARELLA: "Melts well for pizza and pasta.",
  "FRENCH FRIES": "Ready-to-fry, great as a side or snacks.",
  KETCHUP: "Use for burgers, fries, or sandwiches.",
  SAUCE: "Useful for pasta, marinades, or dips.",
  MAYONNAISE: "Great for burgers, wraps, and salads.",
  PASTA: "Pairs well with sauce, cheese, and herbs.",
  NUGGETS: "Quick snack, air-fry or deep-fry.",
  NOODLES: "Stir-fry with veggies and sauces.",
  SUSHI: "Check Japanese section for nori, vinegar, rice.",
  OLIVE: "Nice for salads, pizzas, and sandwiches.",
};

// ---- Messaging ----
function addMessage(sender, html) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.innerHTML = html;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  showClearIfNeeded();
}

function botText(text) {
  addMessage("bot", `<p>${escapeHTML(text)}</p>`);
}

function showWelcomeMessage() {
  const hour = new Date().getHours();
  let greeting = "Welcome to Shivneri Fresh!";
  if (hour < 12) greeting = "Good Morning! Welcome to Shivneri Fresh!";
  else if (hour < 17) greeting = "Good Afternoon! Welcome to Shivneri Fresh!";
  else greeting = "Good Evening! Welcome to Shivneri Fresh!";

  botText(greeting);
  botText(
    'Search by product, brand, or category. Try: “Amul Mozzarella”, “French Fries”, “Tomato Ketchup”.'
  );
  botText(
    'Need help deciding? Ask for items by category like “noodles”, “mayo”, or “olives”.'
  );
}

// ========================================================================
// ==== 🔗 Fetch products (Backend first, fallback to local file) ====
// ========================================================================
fetch("https://shivneri-backend.onrender.com/api/products")
  .then((res) => {
    if (!res.ok) throw new Error("Backend not reachable");
    return res.json();
  })
  .then((data) => setupProducts(data))
  .catch((err) => {
    console.warn("⚠️ Backend not reachable, loading local products.json...", err);
    fetch("products.json")
      .then((res) => {
        if (!res.ok) throw new Error("Local file missing");
        return res.json();
      })
      .then((data) => setupProducts(data))
      .catch(() => {
        botText("Could not load products. Please ensure products.json is present and refresh.");
      });
  });

// ========================================================================
// ==== 🧩 Product normalization + Fuse setup ====
// ========================================================================
function setupProducts(data) {
  const COMMON_CATEGORY_FIXES = {
    "BLACK OILVES": "BLACK OLIVES",
    OILVES: "OLIVES",
    CURSH: "CRUSH",
    "PEELED TOMATO.": "PEELED TOMATO",
    "TOMATO PURRE": "TOMATO PUREE",
    "SUSHI VINGAR": "SUSHI VINEGAR",
    "SEASAME OIL": "SESAME OIL",
    ROSEMERY: "ROSEMARY",
  };

  const normalizeCategory = (cat = "") => {
    const t = String(cat).trim();
    return COMMON_CATEGORY_FIXES[t] || t;
  };

  products = (Array.isArray(data) ? data : []).map((p) => {
    const nameRaw = String(p.name || "").trim();
    let { brand: aliasBrand, consumedTokens } = detectBrandFromNameStart(nameRaw);
    if (!aliasBrand) {
      const firstWord = nameRaw.split(/\s+/)[0] || "";
      aliasBrand = firstWord;
      consumedTokens = 1;
    }

    const canonicalBrand = aliasBrand;
    const nameExpanded = makeExpandedName(nameRaw, canonicalBrand, consumedTokens);
    const category = normalizeCategory(p.category);
    const price = Number(p.price || 0);
    const nameSearch = [nameRaw, nameExpanded].filter(Boolean).join(" • ");

    return {
      name: nameRaw,
      nameExpanded,
      nameSearch,
      canonicalBrand,
      category,
      price,
    };
  });

  // Dynamic brand lookup
  window.BRAND_LOOKUP = {};
  products.forEach((p) => {
    const k = norm(p.canonicalBrand);
    if (k && !window.BRAND_LOOKUP[k]) window.BRAND_LOOKUP[k] = p.canonicalBrand;
  });

  fuse = new Fuse(products, {
    keys: ["name", "brand", "category"],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  showWelcomeMessage();
  updateCheckoutBar();
  console.log("✅ Products loaded successfully:", products.length);
}

// ========================================================================
// ==== 🔍 Search rendering ====
// ========================================================================
function formatItemLine(p) {
  const name = escapeHTML(p.name);
  const price = Number.isFinite(p.price)
    ? fmtINR(p.price)
    : escapeHTML(String(p.price || ""));
  const tipKey = Object.keys(CATEGORY_TIPS).find(
    (k) =>
      p.category.toUpperCase().includes(k) ||
      p.name.toUpperCase().includes(k)
  );
  const tip = tipKey ? CATEGORY_TIPS[tipKey] : "";
  const safeTip = tip ? ` <span class="tip">· ${escapeHTML(tip)}</span>` : "";
  const id = btoa(unescape(encodeURIComponent(`${p.name}|${p.price}`)));

  return `
    <div class="result-line">
      <div class="result-text"><b>${name}</b> – ${price}${safeTip}</div>
      <div class="result-cta">
        <button class="add-btn" data-add="${id}" aria-label="Add ${name} to cart">Add to Cart</button>
      </div>
    </div>
  `;
}

// ========================================================================
// ==== 🧠 Smart Shivneri Local Product Detection ====
// ========================================================================
function findMatchingProducts(query) {
  if (!products || !products.length) return [];

  const fuse = new Fuse(products, {
    keys: ["name", "nameExpanded", "category", "canonicalBrand"],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  const results = fuse.search(norm(query));
  return results.map(r => r.item);
}

// ========================================================================
// ==== 🛒 Cart Operations ====
// ========================================================================
function addToCartById(id) {
  try {
    const decoded = decodeURIComponent(escape(atob(id)));
    const [nm, pr] = decoded.split("|");
    const item = products.find(
      (p) => String(p.name) === nm && String(p.price) === pr
    );
    if (!item) {
      botText("This item is not available right now.");
      return;
    }

    const existing = cart.find(
      (c) => c.name === item.name && String(c.price) === String(item.price)
    );
    if (existing) existing.qty = (Number(existing.qty) || 1) + 1;
    else cart.push({ name: item.name, price: item.price, qty: 1 });

    saveCart();
    botText(`Added: ${item.name} – ${fmtINR(item.price)}. Cart items: ${cartCount()}.`);
  } catch {
    botText("Could not add this item. Please try again.");
  }
}

function clearCart() {
  cart = [];
  try {
    localStorage.removeItem("sf_cart");
  } catch (e) {}
  updateCheckoutBar();
  if (typeof renderMiniCart === "function") renderMiniCart();
  botText("Cart cleared.");
}

// ========================================================================
// ==== 📲 WhatsApp Checkout ====
// ========================================================================
function buildWhatsAppMessage() {
  if (!cart.length) return "Hello, I would like to order.";
  const lines = cart.map(
    (c, i) => `${i + 1}. ${c.name} x ${c.qty || 1} – ${fmtINR(c.price)}`
  );
  const total = cartTotal();
  return encodeURIComponent(
    [
      "Hello, I would like to order:",
      ...lines,
      "",
      `Total: ${fmtINR(total)}`,
      "",
      "Customer details:",
      "Name:",
      "Address:",
      "Phone:",
    ].join("\n")
  );
}

function openWhatsAppCheckout() {
  if (!cart.length) return;
  const text = buildWhatsAppMessage();
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  window.open(url, "_blank");
  clearCart();
  messages.innerHTML = "";
  clearBtn.classList.add("hidden");
  showWelcomeMessage();
}

// ===== Unified Fuzzy Search for Typed and Button Input (Multi-Result Format) =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = input.value.trim();
  if (!userInput) return;

  addMessage("user", escapeHTML(userInput));

  // 1️⃣ Normalize for case-insensitive search
  const query = norm(userInput);

  // 2️⃣ Fuzzy search (same logic as shortcut buttons)
  const matches = findMatchingProducts(query);

  // 3️⃣ Show 5–7 matching products in proper format
  if (matches.length > 0) {
    const unique = [];
    const top = matches
      .filter((p) => {
        if (unique.includes(p.name)) return false;
        unique.push(p.name);
        return true;
      })
      .slice(0, 7)
      .map(formatItemLine) // same card layout as button results
      .join("");

    addMessage(
      "bot",
      `<div class="reply-block">
         ${top}
         <div class="reply-note">Found in Shivneri Fresh catalog ✅</div>
       </div>`
    );
  } else {
    // 4️⃣ Only if no local match → AI fallback
    await callChatAPI(userInput);
  }

  input.value = "";
});

// ========================================================================
// ==== 🧠 AI Chat API ====
// ========================================================================
async function callChatAPI(userInput) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userInput }),
    });

    const data = await res.json();
    if (data.reply) botText(data.reply);
    else botText("Sorry, I couldn’t find anything for that.");
  } catch (err) {
    console.error("Error contacting AI:", err);
    botText("⚠️ Unable to connect to the server. Please try again later.");
  }
}

clearBtn.addEventListener("click", () => {
  messages.innerHTML = "";
  showWelcomeMessage();
  clearBtn.classList.add("hidden");
});

shortcuts?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-shortcut]");
  if (!btn) return;
  const term = btn.getAttribute("data-shortcut");
  addMessage("user", escapeHTML(term));
  const matches = findMatchingProducts(term);
  if (matches.length > 0) {
    const top = matches.slice(0, 7).map(formatItemLine).join("");
    addMessage(
      "bot",
      `<div class="reply-block">${top}<div class="reply-note">Found in Shivneri Fresh catalog ✅</div></div>`
    );
  }
});

messages.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-add]");
  if (!btn) return;
  const id = btn.getAttribute("data-add");
  addToCartById(id);
});

whatsappBtn.addEventListener("click", openWhatsAppCheckout);
clearCartBtn?.addEventListener("click", clearCart);

if (messages.children.length === 0) {
  setTimeout(() => {
    if (!messages.children.length) botText("Loading…");
  }, 500);
}

// ===== Listen for search requests coming from script.js =====
window.addEventListener("shivneriSearch", async (e) => {
  const userInput = e.detail;
  if (!userInput) return;

  addMessage("user", escapeHTML(userInput));

  // Use same fuzzy search logic as button clicks
  const matches = findMatchingProducts(userInput);

  if (matches && matches.length > 0) {
    const shown = [];
    const top = matches
      .filter((p) => {
        if (shown.includes(p.name)) return false;
        shown.push(p.name);
        return true;
      })
      .slice(0, 7) // show top 7 relevant items
      .map(formatItemLine)
      .join("");

    addMessage(
      "bot",
      `
      <div class="reply-block">
        ${top}
        <div class="reply-note">Found in Shivneri Fresh catalog ✅</div>
      </div>
    `
    );
  } else {
    // fallback → AI response if no match found
    try {
      await callChatAPI(userInput);
    } catch (err) {
      botText("⚠️ Server error, please try again later.");
    }
  }
});

updateCheckoutBar();
