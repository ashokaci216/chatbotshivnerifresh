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

// ---- Tips (light guidance) ----
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
  .then((data) => {
    setupProducts(data);
  })
  .catch((err) => {
    console.warn("⚠️ Backend not reachable, loading local products.json...", err);
    fetch("products.json")
      .then((res) => {
        if (!res.ok) throw new Error("Local file missing");
        return res.json();
      })
      .then((data) => {
        setupProducts(data);
      })
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

function searchProduct(query) {
  const raw = String(query || "").trim();
  if (!raw) {
    botText('Please type a product name like "cheese", "mayo", or "nachos".');
    return;
  }

  const { brand, rest } = parseQueryForBrand(raw);
  let list = products;
  if (brand) {
    const b = brand.toLowerCase();
    list = products.filter(
      (p) => (p.canonicalBrand || "").toLowerCase() === b
    );
  }

  const FUSE_OPTS = {
    keys: ["nameSearch", "category"],
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 2,
  };

  const q = rest || raw;
  const localFuse = new Fuse(list, FUSE_OPTS);
  let results = localFuse.search(q);

  let brandNote = "";
  if (brand && results.length === 0) {
    brandNote = `No exact matches in ${brand}. Showing closest items.`;
    const altFuse = new Fuse(products, FUSE_OPTS);
    results = altFuse.search(q);
  }

  if (results.length > 0) {
    const top = results.slice(0, 7).map((r) => formatItemLine(r.item)).join("");
    addMessage(
      "bot",
      `
      <div class="reply-block">
        ${brand ? `<div class="reply-note"><b>Brand:</b> ${brand}</div>` : ""}
        ${brandNote ? `<div class="reply-note">${brandNote}</div>` : ""}
        ${top}
        <div class="reply-note">Would you like to add any of these to your cart?</div>
      </div>
    `
    );
  } else {
    botText(
      `No results for “${raw}”. Try another keyword or a brand name (e.g., Amul, HyFun, Derista).`
    );
  }
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
    botText(
      `Added: ${item.name} – ${fmtINR(item.price)}. Cart items: ${cartCount()}.`
    );
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

// ========================================================================
// ==== 🧾 Mini-Cart Drawer ====
// ========================================================================

function openMiniCart() {
  if (!mini) return;
  mini.classList.add("show");
  mini.setAttribute("aria-hidden", "false");
}

function closeMiniCart() {
  mini?.classList.remove("show");
  mini?.setAttribute("aria-hidden", "true");
}

function renderMiniCart() {
  if (!miniLines) return;
  if (!cart.length) {
    miniLines.innerHTML = `<div class="message bot">Cart is empty.</div>`;
    miniTotal.textContent = fmtINR(0);
    return;
  }
  miniLines.innerHTML = cart
    .map(
      (c, i) => `
    <div class="mini-line" data-i="${i}">
      <div class="mini-name">${escapeHTML(c.name)}</div>
      <div class="qty" role="group" aria-label="Quantity">
        <button class="q-dec" aria-label="Decrease quantity">–</button>
        <span class="q-val">${Number(c.qty) || 1}</span>
        <button class="q-inc" aria-label="Increase quantity">+</button>
      </div>
      <div class="mini-price">${fmtINR(
        (Number(c.qty) || 1) * (Number(c.price) || 0)
      )}</div>
      <button class="mini-remove" aria-label="Remove item">✖</button>
    </div>
  `
    )
    .join("");
  miniTotal.textContent = fmtINR(cartTotal());
}

checkoutInfo?.addEventListener("click", () => {
  renderMiniCart();
  openMiniCart();
});
miniClose?.addEventListener("click", closeMiniCart);
mini?.addEventListener("click", (e) => {
  if (e.target === mini) closeMiniCart();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMiniCart();
});

miniLines?.addEventListener("click", (e) => {
  const row = e.target.closest(".mini-line");
  if (!row) return;
  const idx = Number(row.dataset.i);
  const item = cart[idx];
  if (!item) return;

  if (e.target.classList.contains("q-inc")) {
    item.qty = (Number(item.qty) || 1) + 1;
  } else if (e.target.classList.contains("q-dec")) {
    const newQty = (Number(item.qty) || 1) - 1;
    if (newQty <= 0) {
      cart.splice(idx, 1);
    } else {
      item.qty = newQty;
    }
  } else if (e.target.classList.contains("mini-remove")) {
    cart.splice(idx, 1);
  } else {
    return;
  }

  saveCart();
  updateCheckoutBar();
  renderMiniCart();
});

miniWA?.addEventListener("click", () => {
  closeMiniCart();
  openWhatsAppCheckout();
});

// ========================================================================
// ==== ✉️ Events ====
// ========================================================================

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (query) addMessage("user", escapeHTML(query));
  searchProduct(query);
  input.value = "";
});

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
  searchProduct(term);
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

window.triggerSearch = function (term) {
  const q = String(term || "").trim();
  if (!q) return;
  addMessage("user", escapeHTML(q));
  searchProduct(q);
};

updateCheckoutBar();
