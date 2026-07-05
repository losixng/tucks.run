import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDzwnmGgEcN63RcCHSNU6p_xXKxmeqzF6k",
  authDomain: "losixmarket.firebaseapp.com",
  projectId: "losixmarket",
  storageBucket: "losixmarket.firebasestorage.app",
  messagingSenderId: "301860246689",
  appId: "1:301860246689:web:aabf0ab9af41081a91cce0",
  measurementId: "G-ZPVVZ8GNP0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let firebaseCurrentUser = null;

async function saveCartToUserCart(cartItems) {
  if (!db || !firebaseCurrentUser) return;
  try {
    await setDoc(doc(db, "userCarts", firebaseCurrentUser.uid), {
      items: cartItems,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Cart sync failed", error);
  }
}

function mergeCartItems(remoteItems, localItems) {
  const existingKeys = new Set(remoteItems.map((item) => item.cartKey || `${item.id}-${item.size || ''}-${item.color || ''}`));
  const merged = [...remoteItems];
  localItems.forEach((item) => {
    const key = item.cartKey || `${item.id}-${item.size || ''}-${item.color || ''}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      merged.push(item);
    }
  });
  return merged;
}

async function loadRemoteCartForUser(uid) {
  if (!db || !uid) return;
  try {
    const cartDoc = await getDoc(doc(db, "userCarts", uid));
    if (!cartDoc.exists()) return;
    const remoteData = cartDoc.data();
    const remoteItems = Array.isArray(remoteData?.items) ? remoteData.items : [];
    const localItems = JSON.parse(localStorage.getItem("cart") || "[]");
    const mergedItems = mergeCartItems(remoteItems, localItems);
    if (mergedItems.length) {
      localStorage.setItem("cart", JSON.stringify(mergedItems));
    }
  } catch (error) {
    console.warn("Could not load remote cart", error);
  }
}

const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (key, value) {
  originalSetItem.apply(this, arguments);
  if (key === "cart") {
    try {
      const parsed = JSON.parse(value || "[]");
      if (firebaseCurrentUser) {
        saveCartToUserCart(parsed);
      }
    } catch (error) {
      // ignore invalid cart JSON
    }
  }
};

onAuthStateChanged(auth, async (user) => {
  firebaseCurrentUser = user;
  if (user) {
    await loadRemoteCartForUser(user.uid);
  }
});

// === Tips Rotator ===
const tipsArray = [
   "🥇 Tip: Install for a smooth experience!",
  "💡 Tip: Register to sell with us!",
  "👨‍👩‍👧‍👦 Tip: Share products with famiy and friends!",
  
  "💯 Tip: Become a customer to shop at cheaper prices",
  
  "🚚 Tip: Enjoy free delivery on orders when you become a customer!",
  "⭐ Tip: Please tell us your mind leave a review .",
  "👩🏻‍🦱 Tip: Become a customer now. Register in Profile."
 
];
const tipsEl = document.getElementById("tips");
let tipIndex = 0;
function showNextTip() {
  if (!tipsEl) return;
  tipsEl.style.opacity = "0";
  setTimeout(() => {
    tipsEl.textContent = tipsArray[tipIndex];
    tipsEl.style.opacity = "1";
    tipIndex = (tipIndex + 1) % tipsArray.length;
  }, 300);
}
if (tipsEl) {
  showNextTip();
  setInterval(showNextTip, 5000);
}

// === Search Logic ===
const PRODUCT_PAGES = {
  cshirts: "clothes/cshirts.html",
  shirts: "clothes/shirts.html",
  trousers: "clothes/trousers.html",
  skirts: "clothes/skirts.html",
  gowns: "clothes/gowns.html",
  bubu: "clothes/bubu.html",
  loafers: "footwear/loafers.html",
  slides: "footwear/slides.html",
  sneakers: "footwear/sneakers.html",
  accessoriesgadgets: "gadgets/accessoriesGadgets.html",
  laptops: "gadgets/laptops.html",
  phones: "gadgets/phones.html",
  hairproducts: "hairessentials/hairProducts.html",
  accessoriesjewelry: "jewelry/accessoriesJewelry.html",
  bracelets: "jewelry/bracelets.html",
  chains: "jewelry/chains.html",
  rings: "jewelry/rings.html",
  watches: "jewelry/watches.html",
  matchingsets: "jewelry/matchingSets.html",
  skincare: "skin/skinCare.html",
  thrift: "thrift/thrift.html"
};

const APP_NAME = 'Tucks';
let searchInput = null;
let searchBtn = null;
let suggestionBox = null;
let allProducts = [];
let productsLoaded = false;
let productsLoading = false;
let lastSearchTerm = "";

function normalizeProductType(type) {
  return String(type || "").toLowerCase().replace(/[\s_-]/g, "");
}

function getProductPagePath(p) {
  const typeKey = normalizeProductType(p.type);
  if (PRODUCT_PAGES[typeKey]) return PRODUCT_PAGES[typeKey];

  for (const [key, path] of Object.entries(PRODUCT_PAGES)) {
    if (typeKey.includes(key) || key.includes(typeKey)) return path;
  }
  return null;
}

function getProductPageUrl(p) {
  const pagePath = getProductPagePath(p);
  if (!pagePath || !p.id) return null;
  const id = encodeURIComponent(p.id);
  return `${window.location.origin}/${pagePath}?product=${id}#product-${id}`;
}

function capitalizeWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getProductDepartmentName(product) {
  const typeKey = normalizeProductType(product?.type || product?.category || '');
  if (!typeKey) return 'Tucks';
  const departmentLabels = {
    cshirts: 'Clothes',
    shirts: 'Clothes',
    trousers: 'Clothes',
    skirts: 'Clothes',
    gowns: 'Clothes',
    bubu: 'Clothes',
    loafers: 'Footwear',
    slides: 'Footwear',
    sneakers: 'Footwear',
    accessoriesgadgets: 'Gadgets',
    laptops: 'Gadgets',
    phones: 'Gadgets',
    hairproducts: 'Hair essentials',
    skincare: 'Skin care',
    thrift: 'Thrift',
    accessoriesjewelry: 'Jewelry',
    bracelets: 'Jewelry',
    chains: 'Jewelry',
    rings: 'Jewelry',
    watches: 'Jewelry',
    matchingsets: 'Jewelry'
  };
  return departmentLabels[typeKey] || capitalizeWords(product.type || product.category || typeKey);
}

function generateShareText(product) {
  const url = getProductPageUrl(product) || window.location.href;
  return `Check out ${product.name} on ${APP_NAME} 🛍️ ${url}`;
}

function ensureMetaTag(attributeName, attributeValue, content) {
  let tag = document.head.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
  return tag;
}

function setSocialMetaTags(product, url) {
  const deepUrl = url || getProductPageUrl(product) || window.location.href;
  const title = product.name || `${APP_NAME} Product`;
  const department = getProductDepartmentName(product);
  const description = `Shop ${product.name} — ${department} on ${APP_NAME}. Fast delivery across Nigeria.`;
  const imageUrl = product.image || (Array.isArray(product.images) && product.images[0]) || `${window.location.origin}/logo.png`;

  document.title = title;

  ensureMetaTag('property', 'og:title', title);
  ensureMetaTag('property', 'og:description', description);
  ensureMetaTag('property', 'og:image', imageUrl);
  ensureMetaTag('property', 'og:url', deepUrl);
  ensureMetaTag('property', 'og:type', 'website');

  ensureMetaTag('name', 'twitter:card', 'summary_large_image');
  ensureMetaTag('name', 'twitter:title', title);
  ensureMetaTag('name', 'twitter:description', description);
  ensureMetaTag('name', 'twitter:image', imageUrl);
  ensureMetaTag('name', 'twitter:url', deepUrl);
}

async function fetchProducts() {
  if (productsLoading) return;
  productsLoading = true;
  try {
    const snap = await getDocs(collection(db, "products"));
    allProducts = snap.docs.map(doc => ({
      ...doc.data(),
      id: doc.data().id || doc.id
    }));
    productsLoaded = true;
    if (lastSearchTerm) showResults(lastSearchTerm);
  } catch (err) {
    console.warn("Search: could not load products", err);
    if (suggestionBox && lastSearchTerm) {
      suggestionBox.innerHTML = `<div class="search-suggestion search-suggestion--status">Please check internet connection</div>`;
      suggestionBox.style.display = "block";
    }
  } finally {
    productsLoading = false;
  }
}

function hideSuggestions() {
  if (suggestionBox) suggestionBox.style.display = "none";
}

function showLoadingSuggestions() {
  if (!suggestionBox) return;
  suggestionBox.innerHTML = `<div class="search-suggestion search-suggestion--status">Loading products…</div>`;
  suggestionBox.style.display = "block";
}

function showResults(term) {
  if (!suggestionBox) return;
  lastSearchTerm = term;
  const query = term.toLowerCase().trim();
  suggestionBox.innerHTML = "";

  if (!query) {
    hideSuggestions();
    return;
  }

  if (!productsLoaded) {
    showLoadingSuggestions();
    fetchProducts();
    return;
  }

  const results = allProducts.filter(p =>
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.desc && p.desc.toLowerCase().includes(query)) ||
    (p.type && p.type.toLowerCase().includes(query))
  ).slice(0, 8);

  if (!results.length) {
    suggestionBox.innerHTML = `<div class="search-suggestion search-suggestion--status">This product is currently not available</div>`;
    suggestionBox.style.display = "block";
    return;
  }

  suggestionBox.style.display = "block";
  results.forEach(p => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "search-suggestion";
    const thumb = (p.images && p.images[0]) || p.image || "https://via.placeholder.com/60";
    item.innerHTML = `
      <img src="${thumb}" alt="" class="search-suggestion__thumb"/>
      <div class="search-suggestion__body">
        <div class="search-suggestion__name">${p.name || "Unnamed product"}</div>
        <div class="search-suggestion__price">₦${Number(p.price || 0).toLocaleString()}</div>
      </div>`;
    item.addEventListener("click", () => goToProduct(p));
    suggestionBox.appendChild(item);
  });
}

function goToProduct(p) {
  const pageUrl = getProductPageUrl(p);
  if (!pageUrl) {
    console.warn("Search: no product page for", p);
    return;
  }
  hideSuggestions();
  window.location.href = pageUrl;
}

function standardNavTemplate() {
  return `
  <nav class="bottom-nav" aria-label="Main navigation">
    <a href="/home.html" class="nav-item">
      <i class='bx bxs-home'></i>
      <span>Home</span>
    </a>
    <a href="/cart.html" class="nav-item">
      <i class='bx bx-cart'></i>
      <span>Cart</span>
    </a>
    <a href="/order.html" class="nav-item">
      <i class='bx bx-history'></i>
      <span>Orders</span>
    </a>
    <a href="/profile.html" class="nav-item">
      <i class='bx bxs-user-circle'></i>
      <span>Profile</span>
    </a>
  </nav>`;
}

document.addEventListener('DOMContentLoaded', () => {
  // ensure boxicons available
  if (!document.querySelector('link[href*="boxicons"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
    document.head.appendChild(l);
  }

  // Remove any existing bottom-nav elements and insert standard nav
  document.querySelectorAll('.bottom-nav').forEach(el => el.remove());
  const navContainer = document.createElement('div');
  navContainer.innerHTML = standardNavTemplate();
  document.body.appendChild(navContainer.firstElementChild);

  // ensure shadow element exists
  if (!document.querySelector('.bottom-nav-shadow')) {
    const s = document.createElement('div');
    s.className = 'bottom-nav-shadow';
    document.body.appendChild(s);
  }

  const nav = document.querySelector('.bottom-nav');
  const shadow = document.querySelector('.bottom-nav-shadow');
  if (!nav) return;

  // mark active link based on current path
  try {
    const path = window.location.pathname.replace(/\/index.html$/, '/');
    nav.querySelectorAll('.nav-item').forEach(a => {
      a.classList.remove('active');
      const href = a.getAttribute('href') || '';
      if (href === path || (path.endsWith(href) && href !== '/')) a.classList.add('active');
    });
  } catch (e) { /* ignore */ }

  let lastScrollY = window.scrollY;
  let isHidden = false;
  let scrollTimeout;

  const hideNav = () => {
    if (isHidden) return;
    nav.classList.add('hidden');
    shadow.classList.add('visible');
    isHidden = true;
  };

  const showNav = () => {
    if (!isHidden) return;
    nav.classList.remove('hidden');
    shadow.classList.remove('visible');
    isHidden = false;
  };

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > lastScrollY + 10 && currentScroll > 80) {
      hideNav();
    } else if (currentScroll < lastScrollY - 10) {
      showNav();
    }
    lastScrollY = Math.max(currentScroll, 0);

    window.clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
      if (window.scrollY < 100) showNav();
    }, 150);
  }, { passive: true });

  searchInput = document.getElementById("searchInput");
  searchBtn = document.getElementById("searchBtn");
  suggestionBox = document.getElementById("suggestionBox");

  if (searchInput) {
    searchInput.addEventListener("input", () => showResults(searchInput.value || ""));
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        showResults(searchInput.value || "");
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => showResults(searchInput?.value || ""));
  }

  window.addEventListener('pageshow', showNav);
});
