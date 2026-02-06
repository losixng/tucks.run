import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
  tipsEl.style.opacity = "0";
  setTimeout(() => {
    tipsEl.textContent = tipsArray[tipIndex];
    tipsEl.style.opacity = "1";
    tipIndex = (tipIndex + 1) % tipsArray.length;
  }, 300);
}
setInterval(showNextTip, 5000);

// === Search Logic ===
const departmentMap = {
  adire: ["male", "female", "flamboyant", "trending"],
    ankara: ["male", "female", "trending", "flamboyant"],
    bubu: ["elegant", "flamboyant", "casual", "trending"],
    coupleAnkara: ["elegant", "trending", "flamboyant", "casual"],
    senator: ["corporate", "casual", "owambe"],
    traditional: ["flamboyant", "male", "female", "trending"],
    gowns: ["work", "elegant", "trending"],
    jackets: ["sweatshirts", "trending", "casual"],
    trousers: ["cargo","black","blue","brown", "corporate", "baggy", "sweats"],
    shirts: ["vintage", "casual", "trending", "sporty"],
    skirts: ["body-con", "corporate", "casual", "trending"],
    suits: ["working-class", "blazer", "flamboyant"],
    sandals: ["male", "female", "unisex"],
    heels: ["slippers", "pointed", "wedges"],
    slides: ["nike", "addidas", "palm", "female"],
    sneakers: ["nike", "female", "unisex", "addidas"],
    loafers: ["male", "female", "trending"],
    crocs: ["trending", "addidas", "nike"],
    watches: ["male", "female", "flamboyant"],
    accessoriesJewelry: ["ear rings", "others"],
    bracelets: ["male", "female"],
    chains: ["male", "female"],
    matchingSets: ["chains", "necklaces", "rings"],
    rings: ["male", "female"],
    accessoriesGadgets: ["chargers", "power banks"],
    bluetooth: ["airpods", "speakers", "head sets"],
    gaming: ["playstation", "ps games", "consoles"],
    laptops: ["brand new", "fairly used"],
    phones: ["iphones", "samsung", "fairly used"],
    usedGadgets: ["phones", "laptops"],
    accessories: ["kitchen", "household", "stationaries"],
    bags: ["tote", "fancy"],
    gifts: ["spouse", "bestie"],
    masks: ["lips", "eye bags", "face"],
    prechains: ["male", "female"],
    prerings: ["male", "female"],
    hairProducts : ["hair products"],
    stationaries : ["stationaries"],
    ties : ["ties"],
    fancyGlasses : ["fancy glasses"],
    thrift : ["thrift"],
    clothes : ["cshirts","trousers","shirts"]

};

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const suggestionBox = document.getElementById("suggestionBox");
let allProducts = [];

async function fetchProducts() {
  const snap = await getDocs(collection(db, "products"));
  allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
fetchProducts();

function getDepartmentForProduct(p) {
  const term = (p.type || p.name || "").toLowerCase();
  for (const [dept, keywords] of Object.entries(departmentMap)) {
    if (keywords.some(k => term.includes(k))) return dept;
  }
  return "general";
}

function showResults(term) {
  const query = term.toLowerCase().trim();
  suggestionBox.innerHTML = "";
  if (!query) return (suggestionBox.style.display = "none");

  const results = allProducts.filter(p =>
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.desc && p.desc.toLowerCase().includes(query)) ||
    (p.type && p.type.toLowerCase().includes(query))
  ).slice(0, 6);

  if (!results.length) return (suggestionBox.style.display = "none");
  suggestionBox.style.display = "block";

  results.forEach(p => {
    const item = document.createElement("div");
    item.style = "display:flex;align-items:center;gap:10px;padding:10px;cursor:pointer;border-bottom:1px solid #eee;transition:0.3s;";
    item.innerHTML = `
      <img src="${p.image || 'https://via.placeholder.com/60'}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;"/>
      <div><div style='font-weight:600;'>${p.name}</div><div style='font-size:0.8rem;opacity:0.8;'>₦${p.price?.toLocaleString() || '—'}</div></div>`;
    item.addEventListener("mouseover", () => (item.style.background = "rgb(0, 204, 255)"));
    item.addEventListener("mouseout", () => (item.style.background = "transparent"));
    item.addEventListener("click", () => goToProduct(p));
    suggestionBox.appendChild(item);
  });
}

function goToProduct(p) {
  const department = getDepartmentForProduct(p);
  const type = (p.type || "item").toLowerCase().trim();
  const pageUrl = `${window.location.origin}/${department}/${type}.html?id=${encodeURIComponent(p.id)}`;
  window.location.href = pageUrl;
}

searchInput.addEventListener("input", e => showResults(e.target.value));
searchBtn.addEventListener("click", () => showResults(searchInput.value));
