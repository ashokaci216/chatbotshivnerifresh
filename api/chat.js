// ===== SHIVNERI FRESH CHATBOT (Product + Recipe) =====

// Detect language (future Hinglish option)
function detectLanguage(text) {
  const englishChars = text.replace(/[^a-zA-Z]/g, "").length;
  return englishChars / text.length > 0.6 ? "english" : "hinglish";
}

// Listen to chat form
document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;
  addMessage("You", message);
  handleUserMessage(message);
  input.value = "";
});

// ===== Detect Intent =====
function detectIntent(message) {
  message = message.toLowerCase();
  if (message.includes("recipe") || message.includes("banane") || message.includes("how to make"))
    return "recipe";
  if (/noodles|sauce|mayo|mayonnaise|cheese|paneer|chicken|veg|amul|wingreens|hyfun|frozen|tikka|masala/.test(message))
    return "product";
  return "other";
}

// ===== Handle Message =====
function handleUserMessage(message) {
  const intent = detectIntent(message);

  if (intent === "product") {
    searchCatalog(message);
  } 
  else if (intent === "recipe") {
    showRecipe(message);
  } 
  else {
    addMessage("Bot", "🤖 I can help you with *Shivneri Fresh products* and *simple recipes!* Try typing:\n- 'Wingreens Mayonnaise'\n- 'How to make Schezwan Fried Rice'");
  }
}

// ===== Product Search =====
function searchCatalog(query) {
  if (!window.products || !Array.isArray(products) || products.length === 0) {
    addMessage("Bot", "⚠️ Product list not loaded yet. Please refresh once.");
    return;
  }

  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  if (results.length === 0) {
    addMessage("Bot", "❌ Sorry, that product isn’t in our catalog. Try searching another name like 'Amul Cheese' or 'Schezwan Sauce'.");
    return;
  }

  results.slice(0, 5).forEach((p) => {
    addMessage(
      "Bot",
      `🛒 **${p.name}** – ₹${p.price}\n${p.veg ? "🟢 Veg" : "🔴 Non-Veg"}\n${p.desc || "Delicious and available at Shivneri Fresh!"}`
    );
  });
}

// ===== Recipe Library =====
function showRecipe(query) {
  const dish = query.replace(/recipe|banane|how to make/gi, "").trim().toLowerCase();

  const recipes = {
    "schezwan fried rice": `
**Ingredients:**
- Cooked rice – 2 cups  
- Schezwan sauce – 2 tbsp  
- Mixed vegetables – 1 cup  
- Soy sauce – 1 tbsp  
- Vinegar – 1 tsp  
- Oil, salt to taste  

**Method:**
1. Heat oil, add veggies and stir-fry 2 mins.  
2. Add Schezwan & soy sauce, vinegar.  
3. Mix rice and toss well.  
4. Serve hot with chilli oil or ketchup.`,

    "chilly garlic noodles": `
**Ingredients:**
- Boiled noodles – 2 cups  
- Chopped garlic – 1 tbsp  
- Chilli flakes – 1 tsp  
- Soy sauce – 1 tbsp  
- Spring onion – 2 tbsp  

**Method:**
1. Heat oil, sauté garlic and chilli.  
2. Add noodles and sauces.  
3. Toss 2 mins on high flame.  
4. Garnish with spring onion.`,

    "paneer tikka": `
**Ingredients:**
- Paneer cubes – 200g  
- Hung curd – ½ cup  
- Tikka masala – 1 tbsp  
- Capsicum & onion pieces – ½ cup  
- Oil, salt & lemon  

**Method:**
1. Mix all ingredients and marinate paneer 30 mins.  
2. Grill or pan fry till golden.  
3. Sprinkle lemon juice and serve.`,

    "spring roll": `
**Ingredients:**
- Spring roll sheets  
- Mixed veg – 1 cup  
- Soy sauce – 1 tbsp  
- Cornflour paste – 2 tbsp  

**Method:**
1. Stir-fry vegetables with sauces.  
2. Roll in sheets, seal with paste.  
3. Deep fry till golden and crispy.`,
  };

  const found = Object.keys(recipes).find((key) => dish.includes(key));
  if (found) addMessage("Bot", recipes[found]);
  else addMessage("Bot", "🍳 Recipe not found yet. Try 'Schezwan Fried Rice', 'Paneer Tikka', or 'Spring Roll'.");
}

// ===== Message Display =====
function addMessage(sender, text) {
  const chatBox = document.getElementById("chat-box");
  const msg = document.createElement("div");
  msg.className = sender === "You" ? "msg user" : "msg bot";
  msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}
