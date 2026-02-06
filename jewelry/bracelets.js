/* ============================
   fit8.js - integrated and revised
   - Firestore (fallback)
   - Filters, lightbox (up to 5 images)
   - Cart localStorage
   - Auth (email/password)
   - Buy modal (mobile scrollable)
   - Paystack integration (frontend)
   - Save order to Firestore (if signed in) or localStorage
   - Customize requests (Firestore or local)
   ============================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

/* ============ CONFIG ============ */
/* Replace these values with your Firebase project's config */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzwnmGgEcN63RcCHSNU6p_xXKxmeqzF6k" ,
    authDomain: "losixmarket.firebaseapp.com",
    projectId: "losixmarket" ,
    storageBucket: "losixmarket.firebasestorage.app",
    messagingSenderId: "301860246689",
    appId:"1:301860246689:web:aabf0ab9af41081a91cce0",
    measurementId: "G-ZPVVZ8GNP0"
};
/* Replace with your Paystack public key */
const PAYSTACK_PUBLIC_KEY = "pk_test_f84b249cadf2b30de87df5a566b34ec1e17d9c12";

/* ============ INITIALIZE FIREBASE (try/catch) ============ */
let db = null, auth = null;
try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  auth = getAuth ? getAuth(app) : null;
  console.info("Firebase initialized.");
} catch (e) {
  console.warn("Firebase init failed - running in offline/fallback mode.", e);
  db = null; auth = null;
}

/* ============ SAMPLE PRODUCTS (fallback) ============ */
const SAMPLE_PRODUCTS = [
   {
    id: "temp1",
    name: "Error:Please check internet connection",
    desc: "Please refresh....",
    price: 666666,
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDjxa9w039Pkc6_BaxnkLbBmjaa_oA8srhWA&s",
    images: [
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDjxa9w039Pkc6_BaxnkLbBmjaa_oA8srhWA&s",
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDjxa9w039Pkc6_BaxnkLbBmjaa_oA8srhWA&s"
    ],
    instock: true,
    type: "bracelets",
    categories: ["matching"],
    filters: ["male"]
  }
];

/* ============ STATE & DOM ============ */
const matchingFilters = ["male","female"];
const occasionFilters = ["wedding","parties","church","festive","birthday parties","get together"];

let allMatching = [], allOccasion = [];
let activeMatching = null, activeOccasion = null;
let currentUser = null;
let currentItem = null;
let cart = JSON.parse(localStorage.getItem('sf_cart')||'[]') || [];

/* DOM references */
const matchingFiltersEl = document.getElementById('matchingFilters');
const occasionFiltersEl = document.getElementById('occasionFilters');
const matchingProductsEl = document.getElementById('matchingProducts');
const occasionProductsEl = document.getElementById('occasionProducts');

const lightbox = document.getElementById('lightbox');
const lbMain = document.getElementById('lbMain');
const lbThumbs = document.getElementById('lbThumbs');
const lbName = document.getElementById('lbName');
const lbDesc = document.getElementById('lbDesc');
const lbPrice = document.getElementById('lbPrice');
const lbStock = document.getElementById('lbStock');
const lbBuy = document.getElementById('lbBuy');
const lbAdd = document.getElementById('lbAdd');
const lbShare = document.getElementById('lbShare');

const lbClose = document.getElementById('lbClose');

const buyModal = document.getElementById('buyModal');
const bmThumb = document.getElementById('bmThumb');
const bmTitle = document.getElementById('bmTitle');
const bmPrice = document.getElementById('bmPrice');
const bmName = document.getElementById('buyerName');
const bmPhone = document.getElementById('buyerPhone');
const bmEmail = document.getElementById('buyerEmail');
const bmAddress = document.getElementById('buyerAddress');
const bmShipping = document.getElementById('buyerShipping');
const sumProduct = document.getElementById('sumProduct');
const sumShipping = document.getElementById('sumShipping');
const sumTxn = document.getElementById('sumTxn');
const sumTotal = document.getElementById('sumTotal');
const payNow = document.getElementById('payNow');
const cancelBuy = document.getElementById('cancelBuy');

const customModal = document.getElementById('customModal');
const cName = document.getElementById('cName');
const cPhone = document.getElementById('cPhone');
const cEmail = document.getElementById('cEmail');
const cDetails = document.getElementById('cDetails');
const sendCustomize = document.getElementById('sendCustomize');
const cancelCustomize = document.getElementById('cancelCustomize');

const confirmModal = document.getElementById('confirmModal');
const confirmContent = document.getElementById('confirmContent');
const closeConfirm = document.getElementById('closeConfirm');

const authBox = document.getElementById('authBox');
const signupBtn = document.getElementById('signupBtn');
const signinBtn = document.getElementById('signinBtn');
const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');

const viewCartBtn = document.getElementById('viewCartBtn');
const cartCount = document.getElementById('cartCount');

/* ============ UTILITIES ============ */
function moneyFmt(n){ // safe digit-by-digit formatting
  const v = Number(n || 0);
  // ensure we format reliably
  return '₦' + v.toLocaleString('en-US');
}
function updateCartCount(){
  cart = JSON.parse(localStorage.getItem('sf_cart')||'[]');
  if (cartCount) cartCount.textContent = cart.reduce((s,i)=> s + (i.qty||1), 0);
}
function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style,{position:'fixed',right:18,bottom:18,padding:'10px 14px',background:'#111',color:'#fff',borderRadius:8,zIndex:2000});
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity = 0,1600);
  setTimeout(()=> t.remove(),2200);
}
updateCartCount();

/* ============ AUTH (email/password small UI) ============ */
if(auth){
  onAuthStateChanged(auth, user => {
    currentUser = user;
    renderAuthUI();
  });
}
function renderAuthUI(){
  if(!authBox) return;
  authBox.innerHTML = '';
  if(currentUser){
    const el = document.createElement('div');
    el.style.display='flex'; el.style.gap='8px'; el.style.alignItems='center';
    el.innerHTML = `<div style="font-size:13px">Hi, ${currentUser.email}</div>`;
    const out = document.createElement('button'); out.textContent='Sign out'; out.className='btn ghost';
    out.addEventListener('click', async ()=> { await signOut(auth); toast('Signed out');});
    el.appendChild(out);
    authBox.appendChild(el);
  } else {
    const s = document.createElement('button'); s.textContent='Sign up'; s.className='btn ghost'; s.onclick = ()=> openAuth('signup');
    const i = document.createElement('button'); i.textContent='Sign in'; i.className='btn'; i.onclick = ()=> openAuth('signin');
    authBox.appendChild(s); authBox.appendChild(i);
  }
}
function openAuth(mode='signin'){
  if(!authModal) return;
  authTitle.textContent = mode === 'signin' ? 'Sign In' : 'Sign Up';
  authModal.classList.add('show'); authModal.setAttribute('aria-hidden','false');
  authSubmit.onclick = async ()=> {
    const email = authEmail.value.trim(); const pwd = authPassword.value.trim();
    if(!email || !pwd){ alert('Please fill email and password'); return; }
    try {
      if(mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, pwd);
        toast('Account created');
      } else {
        await signInWithEmailAndPassword(auth, email, pwd);
        toast('Signed in');
      }
      authModal.classList.remove('show');
      authEmail.value = ''; authPassword.value = '';
    } catch (err){
      console.error('Auth error', err);
      alert('Auth: ' + (err.message || err));
    }
  };
}
if(authCancel) authCancel.onclick = ()=> authModal.classList.remove('show');
signupBtn?.addEventListener('click', ()=> openAuth('signup'));
signinBtn?.addEventListener('click', ()=> openAuth('signin'));

/* ============ FILTER UI ============ */
function makeFilterButtons(list, containerEl, isMatching=true){
  if(!containerEl) return;
  containerEl.innerHTML = '';
  list.forEach(f=>{
    const btn = document.createElement('button');
    btn.textContent = f;
    btn.onclick = ()=> {
      if(isMatching) activeMatching = (activeMatching === f ? null : f);
      else activeOccasion = (activeOccasion === f ? null : f);
      updateUI();
    };
    containerEl.appendChild(btn);
  });
}
makeFilterButtons(matchingFilters, matchingFiltersEl, true);
makeFilterButtons(occasionFilters, occasionFiltersEl, false);

/* ============ PRODUCTS: Load from Firestore OR use SAMPLE fallback ============ */
async function initProducts(){
  // Attempt Firestore
  if(db){
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const products = [];
      snapshot.forEach(doc => {
        const data = doc.data() || {};
        // normalize fields and ensure id exists (use doc.id fallback)
        products.push({
          id: data.id || doc.id,
          name: data.name || '',
          desc: data.desc || data.description || '',
          price: Number(data.price || 0),
          image: (data.images && data.images[0]) || data.image || '',
          images: Array.isArray(data.images) ? data.images.slice(0,5) : (data.image ? [data.image] : []),
          instock: typeof data.instock === 'boolean' ? data.instock : (typeof data.inStock === 'boolean' ? data.inStock : true),
          type: (data.type||'').toLowerCase(),
          categories: Array.isArray(data.categories) ? data.categories : (data.categories ? [data.categories] : []),
          filters: Array.isArray(data.filters) ? data.filters : (data.filters ? [data.filters] : [])
        });
      });

      if(products.length > 0){
        console.info('Loaded products from Firestore:', products.length);
        applyProducts(products);
        return;
      } else {
        console.info('Firestore returned 0 products — falling back to SAMPLE_PRODUCTS.');
      }
    } catch (e){
      console.warn('Firestore fetch failed, using SAMPLE_PRODUCTS. Error:', e);
    }
  } else {
    console.info('No Firestore instance - using SAMPLE_PRODUCTS.');
  }

  // fallback
  applyProducts(SAMPLE_PRODUCTS);
}

function applyProducts(allProducts){
  // Only use those with type 'fits'
  const fits = allProducts.filter(p => (p.type || '').toLowerCase() === 'bracelets');
  allMatching = fits.filter(p => (p.categories || []).map(c=>c.toLowerCase()).includes('matching'));
  allOccasion = fits.filter(p => (p.categories || []).map(c=>c.toLowerCase()).includes('occasion'));
  updateUI();
}

initProducts();

/* ============ RENDER + UI update ============ */
function renderGrid(list, containerEl, activeFilter){
  if(!containerEl) return;
  containerEl.innerHTML = '';
  let filtered = list;
  if(activeFilter){
    filtered = list.filter(p => {
      if(Array.isArray(p.filters) && p.filters.length) return p.filters.map(x=>x.toLowerCase()).includes(String(activeFilter).toLowerCase());
      if(Array.isArray(p.categories) && p.categories.length) return p.categories.map(x=>x.toLowerCase()).includes(String(activeFilter).toLowerCase());
      return String(p.categories || '').toLowerCase().includes(String(activeFilter).toLowerCase());
    });
  }
  filtered.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'card';
    const bg = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.image || '');
    card.style.backgroundImage = `url(${bg})`;
    if(!p.instock) card.setAttribute('aria-disabled','true');

    card.innerHTML = `
      <div class="card-overlay">
        <div class="card-title">${p.name}</div>
        <div class="card-desc">${(p.desc||'').slice(0,70)}</div>
        <div class="card-price">${moneyFmt(p.price)}</div>
      </div>
      ${p.instock ? '' : '<div class="sold-out">SOLD OUT</div>'}
    `;

    card.addEventListener('click', ()=> { if(p.instock) openLightbox(p); else toast('This item is out of stock'); });
    containerEl.appendChild(card);
  });
}

function updateUI(){
  renderGrid(allMatching, matchingProductsEl, activeMatching);
  renderGrid(allOccasion, occasionProductsEl, activeOccasion);
  if(matchingFiltersEl) {
    document.querySelectorAll('#matchingFilters button').forEach(b => b.classList.toggle('active', b.textContent === activeMatching));
  }
  if(occasionFiltersEl) {
    document.querySelectorAll('#occasionFilters button').forEach(b => b.classList.toggle('active', b.textContent === activeOccasion));
  }
}

/* ============ LIGHTBOX (up to 5 images) ============ */
function openLightbox(item){
  currentItem = item;
  const imgs = (Array.isArray(item.images) && item.images.length) ? item.images.slice(0,5) : (item.image ? [item.image] : []);
  if(lbMain) {
    lbMain.style.backgroundImage = imgs.length ? `url(${imgs[0]})` : 'none';
    lbMain.textContent = imgs.length ? '' : 'No image';
  }
  if(lbThumbs) {
    lbThumbs.innerHTML = '';
    imgs.forEach((u,i)=>{
      const t = document.createElement('div'); t.className = 'thumb' + (i===0 ? ' active' : ''); t.style.backgroundImage = `url(${u})`;
      t.addEventListener('click', ()=> {
        if(lbMain) lbMain.style.backgroundImage = `url(${u})`;
        lbThumbs.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
      });
      lbThumbs.appendChild(t);
    });
  }
  if(lbName) lbName.textContent = item.name;
  if(lbDesc) lbDesc.textContent = item.desc || '';
  if(lbPrice) lbPrice.textContent = moneyFmt(item.price);
  if(lbStock) lbStock.textContent = item.instock ? '✅ In stock' : '❌ Out of stock';
  if(lbBuy) lbBuy.disabled = !item.instock;
  if(lbAdd) lbAdd.disabled = !item.instock;

  if(lightbox) { lightbox.classList.add('show'); lightbox.setAttribute('aria-hidden','false'); }
}
function closeLightbox(){ if(lightbox){ lightbox.classList.remove('show'); lightbox.setAttribute('aria-hidden','true'); } }
lbClose?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', (e)=> { if(e.target === lightbox) closeLightbox(); });

/* Lightbox actions */
lbAdd?.addEventListener('click', ()=> { if(currentItem) { addToCart(currentItem); closeLightbox(); } });
lbShare?.addEventListener('click', async ()=> {
  if(!currentItem) return;
  const shareUrl = location.origin + location.pathname + `?product=${encodeURIComponent(currentItem.name)}`;
  try {
    if(navigator.share) await navigator.share({ title: currentItem.name, text: currentItem.desc||'', url: shareUrl });
    else { await navigator.clipboard.writeText(`${currentItem.name}\n${currentItem.desc||''}\n${shareUrl}`); toast('Product info copied'); }
  } catch(e) { console.warn(e); toast('Could not share'); }
});


/* ============ BUY FLOW (modal + Paystack) ============ */
function recalcTotals(){
  if(!currentItem) return null;
  const price = Number(currentItem.price) || 0;
  const shipping = bmShipping && bmShipping.value === 'GIG' ? 5000 : 3000;
  const txn = 100;
  const total = price + shipping + txn;
  if(sumProduct) sumProduct.textContent = moneyFmt(price);
  if(sumShipping) sumShipping.textContent = moneyFmt(shipping);
  if(sumTxn) sumTxn.textContent = moneyFmt(txn);
  if(sumTotal) sumTotal.textContent = moneyFmt(total);
  return { price, shipping, txn, total };
}
bmShipping?.addEventListener('change', recalcTotals);

lbBuy?.addEventListener('click', ()=> {
  if(!currentItem) return;
  if(bmThumb) bmThumb.style.backgroundImage = currentItem.image ? `url(${currentItem.image})` : 'none';
  if(bmTitle) bmTitle.textContent = currentItem.name;
  if(bmPrice) bmPrice.textContent = moneyFmt(currentItem.price);
  if(bmName) bmName.value = currentUser?.displayName || '';
  if(bmEmail) bmEmail.value = currentUser?.email || '';
  if(bmPhone) bmPhone.value = currentUser?.phoneNumber || '';
  if(bmShipping) bmShipping.value = 'NURTW';
  recalcTotals();
  if(buyModal) { buyModal.classList.add('show'); buyModal.setAttribute('aria-hidden','false'); }
});

cancelBuy?.addEventListener('click', ()=> { if(buyModal) buyModal.classList.remove('show'); });

payNow?.addEventListener('click', async ()=>{
  if(!currentItem) return;
  const name = bmName?.value?.trim(); const phone = bmPhone?.value?.trim();
  const email = bmEmail?.value?.trim(); const address = bmAddress?.value?.trim();
  if(!name || !phone || !email || !address) { alert('Please fill name, phone, email and address'); return; }
  const totals = recalcTotals();
  if(!totals) return;

  const order = {
    userId: currentUser ? currentUser.uid : null,
    customer: { name, phone, email, address },
    product: { id: currentItem.id, name: currentItem.name, price: Number(currentItem.price), images: currentItem.images || (currentItem.image ? [currentItem.image] : []) },
    shippingMethod: bmShipping.value,
    shippingFee: totals.shipping,
    transactionFee: totals.txn,
    customizeFee: 0,
    total: totals.total,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  if(typeof PaystackPop === 'undefined') { alert('Paystack not loaded. Make sure you included the Paystack script.'); return; }

  // IMPORTANT: Use your Paystack public key here (set at top)
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: Math.round(order.total * 100), // kobo
    currency: 'NGN',
    metadata: { custom_fields: [{ display_name: "Product", variable_name: "product", value: order.product.name }] },
   callback: function(response){
         (async () => {
           order.paystackRef = response.reference;
           order.status = 'paid';
       
           // 🔒 Verify payment securely with your Netlify backend
           const verifyRes = await fetch("/api/verifyPayment", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ reference: response.reference })
           });
       
           const verifyData = await verifyRes.json();
       
           if (!verifyData.data || verifyData.data.status !== "success") {
             alert("⚠️ Payment verification failed! Please contact support.");
             console.error("Verification failed:", verifyData);
             return;
           }
       
           try {
             if (db) {
               await addDoc(collection(db, 'orders'), {
                 ...order,
                 userId: currentUser ? currentUser.uid : null,
                 createdAt: serverTimestamp()
               });
             } else {
               toast('Error: Please try again....');
             }
           } catch (e) {
             console.warn('Could not save order to Firestore', e);
             const ordersLocal = JSON.parse(localStorage.getItem('orders') || '[]');
             ordersLocal.push(order);
             localStorage.setItem('orders', JSON.stringify(ordersLocal));
           }
       
           saveOrderAsHTML(order);
       
           if (confirmContent) {
             confirmContent.innerHTML = `
               ✅ Payment successful. Reference: <strong>${response.reference}</strong><br/>
               Total: ${moneyFmt(order.total)}<br/>
               We saved a copy of your order (downloaded).
             `;
           }
           if (confirmModal) {
             confirmModal.classList.add('show');
             confirmModal.setAttribute('aria-hidden', 'false');
           }
           if (buyModal) buyModal.classList.remove('show');
         })();
       },
    onClose: function(){
      flashMessage('Payment cancelled.');
    }
  });
  handler.openIframe();
});

/* ============ Save order as HTML ============ */
function saveOrderAsHTML(order){
  const imagesHtml = (order.product.images || []).map(u => `<img src="${u}" style="max-width:150px;margin:6px" />`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title >RECEIPT</title>
  <style>body{font-family:Arial;padding:16px} .card{border-radius:10px;padding:14px;border:1px solid #eee}</style></head><body>
  <div class="card">
    <h2>RECEIPT</h2>
    <p><strong>Product:</strong> ${order.product.name}</p>
    <p>${imagesHtml}</p>
    <p><strong>Price:</strong> ₦${order.product.price}</p>
    <p><strong>Shipping:</strong> ${order.shippingMethod} (₦${order.shippingFee})</p>
    <p><strong>Transaction fee:</strong> ₦${order.transactionFee}</p>
    <p><strong>Total:</strong> ₦${order.total}</p>
    <p><strong>Reference:</strong> ${order.paystackRef || 'N/A'}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
  <footer><strong  style="padding-top:20px; color: #111;">Issued by Losix Team</strong></footer>
   </div></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'RECEIPT FROM  market';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/* ============ Customization request ============ */
sendCustomize?.addEventListener('click', async ()=>{
  const payload = {
    name: cName?.value?.trim(),
    phone: cPhone?.value?.trim(),
    email: cEmail?.value?.trim(),
    details: cDetails?.value?.trim(),
    productId: currentItem ? currentItem.id : null,
    createdAt: new Date().toISOString()
  };
  if(!payload.name || !payload.phone || !payload.email || !payload.details){ alert('Fill customization fields'); return; }
  try {
    if(db) await addDoc(collection(db,'customRequests'), payload);
    else throw new Error('No DB - saved locally');
    flashMessage('Customization request submitted.');
    if(customModal) customModal.classList.remove('show');
  } catch (e){
    const local = JSON.parse(localStorage.getItem('customRequests')||'[]'); local.push(payload); localStorage.setItem('customRequests', JSON.stringify(local));
    flashMessage('Saved locally (will upload when server available).');
    if(customModal) customModal.classList.remove('show');
  }
});
cancelCustomize?.addEventListener('click', ()=> customModal.classList.remove('show'));

/* ============ CART ============ */
function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.push(product);
  localStorage.setItem("cart", JSON.stringify(cart));
  alert(product.name + " added to cart!");
}
/* ============ MISC UI ============ */
closeConfirm?.addEventListener('click', ()=> confirmModal.classList.remove('show'));
document.addEventListener('keydown', e=> { if(e.key === 'Escape'){ closeLightbox(); if(buyModal) buyModal.classList.remove('show'); if(customModal) customModal.classList.remove('show'); if(confirmModal) confirmModal.classList.remove('show'); if(authModal) authModal.classList.remove('show'); }});

