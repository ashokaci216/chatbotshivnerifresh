let products = [];
let fuse;

fetch('products.json')
  .then(res => res.json())
  .then(data => {
    products = data;

    fuse = new Fuse(products, {
      keys: ['name', 'category'],
      threshold: 0.4
    });

    showWelcomeMessage();
  });

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const messages = document.getElementById('messages');
const clearBtn = document.getElementById('clear-chat');

form.addEventListener('submit', e => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) {
    addMessage('bot', "📝 Please type a product name like 'cheese', 'mayo', or 'nachos'.");
    return;
  }
  addMessage('user', query);
  searchProduct(query);
  input.value = '';
  clearBtn.classList.remove('hidden');
});

function addMessage(sender, text) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerHTML = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function searchProduct(query) {
  if (!fuse) {
    addMessage('bot', '⏳ Loading products... Please wait.');
    return;
  }

  const results = fuse.search(query);
  if (results.length > 0) {
    results.slice(0, 5).forEach(result => {
      const product = result.item;
      addMessage('bot', `✅ ${product.name} – ₹${product.price}`);
    });
  } else {
    addMessage('bot', `🙁 No results for “${query}”. Try something else.`);
  }
}

function showWelcomeMessage() {
  const hour = new Date().getHours();
  let greeting = "👋 Welcome to Shivneri Fresh!";
  if (hour < 12) greeting = "🌞 Good Morning! Welcome to Shivneri Fresh!";
  else if (hour < 17) greeting = "☀️ Good Afternoon! Welcome to Shivneri Fresh!";
  else greeting = "🌙 Good Evening! Welcome to Shivneri Fresh!";

  addMessage('bot', greeting);
  addMessage('bot', "Search by brand: [🧀 Amul] [🍗 Nutrich]");
  addMessage('bot', "Looking for something else?<br>Type: <b>‘burger patty’</b>, <b>‘mayo’</b>, <b>‘nuggets’</b>, <b>‘popcorn’</b>");
}

function triggerSearch(term) {
  addMessage('user', term);
  searchProduct(term);
  clearBtn.classList.remove('hidden');
}

clearBtn.addEventListener('click', () => {
  messages.innerHTML = '';
  clearBtn.classList.add('hidden');
  showWelcomeMessage();
});
