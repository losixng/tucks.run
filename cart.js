import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzwnmGgEcN63RcCHSNU6p_xXKxmeqzF6k",
  authDomain: "losixmarket.firebaseapp.com",
  projectId: "losixmarket",
  storageBucket: "losixmarket.firebasestorage.app",
  messagingSenderId: "301860246689",
  appId: "1:301860246689:web:aabf0ab9af41081a91cce0",
  measurementId: "G-ZPVVZ8GNP0"
};

const PAYSTACK_PUBLIC_KEY = "pk_test_f84b249cadf2b30de87df5a566b34ec1e17d9c12";
const CART_KEY = "cart";
const APP_NAME = "Tucks";

let db = null;
let auth = null;
let currentUser = null;
let cartItems = [];
let sharedCartMeta = null;
let sharedCartId = null;
let isSharedView = false;

const cartListEl = document.getElementById("cartList");
const emptyStateEl = document.getElementById("emptyState");
const cartMainEl = document.getElementById("cartMain");
const cartCountEl = document.getElementById("cartCount");
const sharedBannerEl = document.getElementById("sharedBanner");
const sumSubtotalEl = document.getElementById("sumSubtotal");
const sumShippingEl = document.getElementById("sumShipping");
const sumTxnEl = document.getElementById("sumTxn");
const sumTotalEl = document.getElementById("sumTotal");
const checkoutTotalEl = document.getElementById("checkoutTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const shareCartBtn = document.getElementById("shareCartBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const copyToMyCartBtn = document.getElementById("copyToMyCartBtn");
const shareModal = document.getElementById("shareModal");
const checkoutModal = document.getElementById("checkoutModal");
const confirmModal = document.getElementById("confirmModal");
const toastEl = document.getElementById("toast");
const itemOptionListEl = document.getElementById("itemOptionList");

try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase unavailable", e);
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  prefillPayerFromUser();
});

function moneyFmt(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function persistOrderLocally(order) {
  try {
    const orders = JSON.parse(localStorage.getItem("orders") || "[]");
    const idx = orders.findIndex((existing) => {
      return (
        existing.orderId === order.orderId ||
        existing.paystackRef === order.paystackRef ||
        existing.transactionId === order.transactionId
      );
    });

    if (idx >= 0) {
      orders[idx] = order;
    } else {
      orders.push(order);
    }

    localStorage.setItem("orders", JSON.stringify(orders));
  } catch (err) {
    console.warn("Could not persist local order", err);
  }
}

function normalizeItem(raw, index) {
  const image = raw.image || (Array.isArray(raw.images) ? raw.images[0] : "") || "";
  return {
    cartKey: raw.cartKey || `${raw.id || "item"}-${index}`,
    id: raw.id || `item-${index}`,
    name: raw.name || "Product",
    desc: raw.desc || "",
    price: Number(raw.price) || 0,
    image,
    images: raw.images || (image ? [image] : []),
    type: raw.type || "",
    qty: Math.max(1, Number(raw.qty) || 1),
    size: raw.size || "",
    color: raw.color || "",
    notes: raw.notes || "",
    supplierEmail: raw.supplierEmail || "",
    supplierName: raw.supplierName || "",
    supplierCategory: raw.supplierCategory || "",
    stockQty: Number(raw.stockQty || 0),
    instock: typeof raw.instock === 'boolean' ? raw.instock : (typeof raw.inStock === 'boolean' ? raw.inStock : raw.instock),
    saleStart: raw.saleStart || "",
    saleEnd: raw.saleEnd || "",
    sizeVariants: Array.isArray(raw.sizeVariants) ? raw.sizeVariants : [],
    colorVariants: Array.isArray(raw.colorVariants) ? raw.colorVariants : [],
    variantMatrix: Array.isArray(raw.variantMatrix) ? raw.variantMatrix : []
  };
}

function getUniqueItemOptionValues(matrix, field, stockQty, includeUnavailable = false) {
  const values = [];
  const seen = new Set();
  (matrix || []).forEach((row) => {
    const val = String(row[field] || '').trim();
    if (!val || seen.has(val)) return;
    const qty = row.qty != null ? Number(row.qty) : Number(stockQty || 0);
    if (!includeUnavailable && qty <= 0) return;
    seen.add(val);
    values.push(val);
  });
  return values;
}

function getOptionQtyForValue(matrix, field, value, stockQty) {
  return (matrix || []).reduce((maxQty, row) => {
    const val = String(row[field] || '').trim();
    if (!val || val !== String(value).trim()) return maxQty;
    const qty = row.qty != null ? Number(row.qty) : Number(stockQty || 0);
    return Math.max(maxQty, qty);
  }, 0);
}

function getItemOptionTypeConfig(item) {
  if (window.ProductOptions?.getTypeConfig) {
    return window.ProductOptions.getTypeConfig(item);
  }
  return null;
}

function getItemOptionCategoryDefaults(item) {
  if (window.ProductOptions?.getCategoryDefaults) {
    return window.ProductOptions.getCategoryDefaults(item) || { sizes: [], colors: [] };
  }
  return { sizes: [], colors: [] };
}

function getItemOptionSchema(item) {
  const matrix = window.ProductOptions ? window.ProductOptions.resolveVariantMatrix(item) : (item.variantMatrix || []);
  const stockQty = Number(item.stockQty || 0);
  let sizes = getUniqueItemOptionValues(matrix, 'size', stockQty, true);
  let colors = getUniqueItemOptionValues(matrix, 'color', stockQty, true);

  if ((!sizes.length || !colors.length) && window.ProductOptions) {
    const cfg = getItemOptionTypeConfig(item);
    const defaults = getItemOptionCategoryDefaults(item);
    if (!sizes.length && Array.isArray(defaults.sizes) && defaults.sizes.length) {
      sizes = defaults.sizes.slice();
    }
    if (!colors.length && Array.isArray(defaults.colors) && defaults.colors.length) {
      colors = defaults.colors.slice();
    }
    if (!sizes.length && cfg?.sizeType === window.ProductOptions.SIZE_TYPES.CLOTHING && cfg?.showSize) {
      sizes = defaults.sizes.slice();
    }
  }

  return {
    matrix,
    sizes,
    colors
  };
}

function getItemOptionRequirements(item) {
  const { sizes, colors } = getItemOptionSchema(item);
  return {
    sizeRequired: sizes.length > 0,
    colorRequired: colors.length > 0
  };
}

function getCartFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCartToStorage(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

async function saveUserCartToFirestore(items) {
  if (!db || !currentUser) return;
  try {
    await setDoc(doc(db, "userCarts", currentUser.uid), {
      items,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Failed to save cart to Firestore", error);
  }
}

async function loadUserCartFromFirestore() {
  if (!db || !currentUser) return [];
  try {
    const userCartDoc = await getDoc(doc(db, "userCarts", currentUser.uid));
    if (!userCartDoc.exists()) return [];
    const data = userCartDoc.data();
    return Array.isArray(data?.items) ? data.items.map(normalizeItem) : [];
  } catch (error) {
    console.warn("Could not load user cart", error);
    return [];
  }
}

function mergeCartItems(remoteItems, localItems) {
  const existing = new Map();
  remoteItems.forEach((item) => {
    const key = item.cartKey || `${item.id}-${item.size || ''}-${item.color || ''}`;
    existing.set(key, item);
  });
  localItems.forEach((item) => {
    const key = item.cartKey || `${item.id}-${item.size || ''}-${item.color || ''}`;
    if (!existing.has(key)) existing.set(key, item);
  });
  return Array.from(existing.values());
}

async function syncCartWithUser() {
  if (!currentUser || isSharedView) return;
  const localItems = getCartFromStorage().map(normalizeItem);
  const remoteItems = await loadUserCartFromFirestore();
  let merged = localItems;
  if (!remoteItems.length && localItems.length) {
    merged = localItems;
    await saveUserCartToFirestore(merged);
  } else if (remoteItems.length && !localItems.length) {
    merged = remoteItems;
    saveCartToStorage(merged);
  } else if (remoteItems.length && localItems.length) {
    merged = mergeCartItems(remoteItems, localItems);
    saveCartToStorage(merged);
    await saveUserCartToFirestore(merged);
  }
  cartItems = merged.map(normalizeItem);
  renderCart();
}

function generateShareId() {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadSharedCart(id) {
  if (!db) {
    toast("Cannot load shared cart offline.");
    return false;
  }
  const snap = await getDoc(doc(db, "sharedCarts", id));
  if (!snap.exists()) {
    toast("Shared cart not found or expired.");
    return false;
  }
  const data = snap.data();
  cartItems = (data.items || []).map(normalizeItem);
  sharedCartMeta = data;
  sharedCartId = id;
  isSharedView = true;
  return true;
}

async function initCart() {
  const params = new URLSearchParams(location.search);
  const shareId = params.get("cart");

  if (shareId) {
    const ok = await loadSharedCart(shareId);
    if (!ok) cartItems = getCartFromStorage().map(normalizeItem);
  } else {
    cartItems = getCartFromStorage().map(normalizeItem);
  }

  renderCart();
  updateMetaTags();
}

function updateMetaTags() {
  const title = isSharedView
    ? `Shared cart on ${APP_NAME}`
    : `Your cart — ${APP_NAME}`;
  document.title = title;

  let desc = document.querySelector('meta[name="description"]');
  if (!desc) {
    desc = document.createElement("meta");
    desc.name = "description";
    document.head.appendChild(desc);
  }
  desc.content = isSharedView
    ? `${cartItems.length} item(s) shared with you on ${APP_NAME}. View and checkout.`
    : `Review ${cartItems.length} item(s) in your ${APP_NAME} cart.`;
}

function renderSharedBanner() {
  if (!sharedBannerEl) return;
  if (!isSharedView || !sharedCartMeta) {
    sharedBannerEl.hidden = true;
    return;
  }
  const owner = sharedCartMeta.owner?.name || "Someone";
  const recipient = sharedCartMeta.recipient?.name;
  sharedBannerEl.hidden = false;
  sharedBannerEl.innerHTML = `
    <i class='bx bx-gift'></i>
    <div>
      <strong>Shared cart</strong>
      <p>From <strong>${escapeHtml(owner)}</strong>${recipient ? ` · intended for <strong>${escapeHtml(recipient)}</strong>` : ""}</p>
      ${sharedCartMeta.message ? `<p class="share-msg">"${escapeHtml(sharedCartMeta.message)}"</p>` : ""}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCart() {
  renderSharedBanner();

  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  if (cartCountEl) cartCountEl.textContent = String(count);

  if (!cartItems.length) {
    if (emptyStateEl) emptyStateEl.hidden = false;
    if (cartMainEl) cartMainEl.hidden = true;
    if (checkoutBtn) checkoutBtn.disabled = true;
    if (shareCartBtn) shareCartBtn.disabled = true;
    if (clearCartBtn) clearCartBtn.disabled = true;
    if (itemOptionListEl) itemOptionListEl.innerHTML = "";
    return;
  }

  if (emptyStateEl) emptyStateEl.hidden = true;
  if (cartMainEl) cartMainEl.hidden = false;
  if (checkoutBtn) checkoutBtn.disabled = false;
  if (shareCartBtn) shareCartBtn.disabled = false;
  if (clearCartBtn) clearCartBtn.disabled = isSharedView;
  if (copyToMyCartBtn) copyToMyCartBtn.hidden = !isSharedView;

  if (cartListEl) {
    cartListEl.innerHTML = cartItems.map((item, index) => {
      const img = item.image ? `url(${item.image})` : "none";
      const meta = [item.size, item.color].filter(Boolean).join(" · ");
      return `
        <article class="cart-item" data-index="${index}">
          <div class="cart-item-thumb" style="background-image:${img}"></div>
          <div class="cart-item-body">
            <h3>${escapeHtml(item.name)}</h3>
            ${meta ? `<p class="cart-item-meta">${escapeHtml(meta)}</p>` : ""}
            <p class="cart-item-price">${moneyFmt(item.price)}</p>
            <div class="qty-row">
              <button type="button" class="qty-btn" data-action="dec" data-index="${index}" aria-label="Decrease quantity">−</button>
              <span class="qty-val">${item.qty}</span>
              <button type="button" class="qty-btn" data-action="inc" data-index="${index}" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove item"><i class='bx bx-trash'></i></button>
        </article>
      `;
    }).join("");
  }

  if (itemOptionListEl) {
    itemOptionListEl.innerHTML = cartItems.map((item, index) => {
      // resolve variant matrix and available lists
      const matrix = window.ProductOptions ? window.ProductOptions.resolveVariantMatrix(item) : (item.variantMatrix || []);
      const stockQty = Number(item.stockQty || 0);
      const sizes = getUniqueItemOptionValues(matrix, 'size', stockQty, true);
      const colors = getUniqueItemOptionValues(matrix, 'color', stockQty, true);
      if (item.size && !sizes.includes(item.size)) sizes.unshift(item.size);
      if (item.color && !colors.includes(item.color)) colors.unshift(item.color);
      const avail = availableQtyForItem(item);

      const sizeField = sizes.length ? `
        <label for="itemSize-${index}">Size</label>
        <select id="itemSize-${index}">
          <option value="" ${!item.size ? 'selected' : ''} disabled>Select size</option>
          ${sizes.map(s => {
            const available = getOptionQtyForValue(matrix, 'size', s, stockQty) > 0;
            return `<option value="${escapeHtml(s)}" ${s === item.size ? 'selected' : ''} ${available ? '' : 'disabled'}>${escapeHtml(s)}${available ? '' : ' (unavailable)'}</option>`;
          }).join('')}
        </select>
      ` : '';

      const colorField = colors.length ? `
        <label for="itemColor-${index}">Colour</label>
        <select id="itemColor-${index}">
          <option value="" ${!item.color ? 'selected' : ''} disabled>Select colour</option>
          ${colors.map(c => {
            const available = getOptionQtyForValue(matrix, 'color', c, stockQty) > 0;
            return `<option value="${escapeHtml(c)}" ${c === item.color ? 'selected' : ''} ${available ? '' : 'disabled'}>${escapeHtml(c)}${available ? '' : ' (unavailable)'}</option>`;
          }).join('')}
        </select>
      ` : '';

      const notesField = `
        <label for="itemNotes-${index}">Product note</label>
        <textarea id="itemNotes-${index}" rows="2" placeholder="Special request / detail">${escapeHtml(item.notes || '')}</textarea>
      `;

      const noOptionsHint = (!sizeField && !colorField)
        ? `<p style="color: var(--text-muted);font-size:0.9rem;margin-top:10px;">This item has no selectable size or colour options.</p>`
        : '';

      const soldHtml = avail <= 0 ? `<div class="sold-out" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.65);color:#fff;font-weight:800;font-size:1rem;z-index:5;box-shadow:0 8px 30px rgba(0,0,0,0.4);">SOLD OUT</div>` : '';

      return `
      <div class="item-detail-card" data-index="${index}" style="position:relative;">
        ${soldHtml}
        <h4>${escapeHtml(item.name)} (${item.qty}x)</h4>
        <div id="itemStock-${index}" style="font-size:0.9rem;color:var(--text-muted);margin-top:6px">Checking availability...</div>
        <div class="item-detail-grid">
          ${sizeField}
          ${colorField}
          ${notesField}
        </div>
      </div>
    `;
    }).join("");
  }

  // update stock hints after DOM rendered
  updateStockHints();

  recalcTotals();
}

async function fetchProductDetailsForCart() {
  if (!db) return;
  for (let i = 0; i < cartItems.length; i++) {
    const it = cartItems[i];
    if (!it.id) continue;
    try {
      const snap = await getDoc(doc(db, 'products', it.id));
      if (snap && snap.exists && snap.exists()) {
        const data = snap.data();
        // merge relevant fields that affect availability
        cartItems[i] = { ...it, ...{
          variantMatrix: data.variantMatrix || it.variantMatrix,
          sizeVariants: data.sizeVariants || it.sizeVariants,
          colorVariants: data.colorVariants || it.colorVariants,
          stockQty: typeof data.stockQty === 'number' ? data.stockQty : (it.stockQty || 0),
          saleStart: data.saleStart || it.saleStart,
          saleEnd: data.saleEnd || it.saleEnd,
          instock: typeof data.instock === 'boolean' ? data.instock : (typeof data.inStock === 'boolean' ? data.inStock : it.instock)
        } };
      }
    } catch (e) {
      console.warn('Could not refresh product', it.id, e);
    }
  }
}

function availableQtyForItem(item) {
  try {
    if (window.ProductOptions) {
      const matrix = window.ProductOptions.resolveVariantMatrix(item) || [];
      const stockQty = Number(item.stockQty || 0);
      if (matrix && matrix.length) {
        const selectedSize = String(item.size || '').trim();
        const selectedColor = String(item.color || '').trim();
        const exactRow = matrix.find((r) => (r.size || '') === selectedSize && (r.color || '') === selectedColor);
        if (exactRow) return Number(exactRow.qty || 0);

        const matchingRows = matrix.filter((r) => {
          const rowSize = String(r.size || '').trim();
          const rowColor = String(r.color || '').trim();
          if (selectedSize && rowSize !== selectedSize) return false;
          if (selectedColor && rowColor !== selectedColor) return false;
          return true;
        });

        if (matchingRows.length) {
          const availableRows = matchingRows
            .map((r) => (r.qty != null ? Number(r.qty) : stockQty))
            .filter((qty) => qty > 0);
          if (availableRows.length) return Math.max(...availableRows);
        }

        const availableRows = matrix
          .map((r) => (r.qty != null ? Number(r.qty) : stockQty))
          .filter((qty) => qty > 0);
        if (availableRows.length) return Math.max(...availableRows);
        return 0;
      }
    }
  } catch (e) {
    console.warn('availability check failed', e);
  }
  return Number(item.stockQty || 0) || 0;
}
function updateStockHints() {
  cartItems.forEach((item, index) => {
    const el = document.getElementById(`itemStock-${index}`);
    if (!el) return;
    const requirements = getItemOptionRequirements(item);
    // check sale/timeline availability first
    if (window.evaluateProductStock && !window.evaluateProductStock(item)) {
      el.textContent = 'Unavailable (outside sale window)';
      el.style.color = 'var(--danger)';
      return;
    }
    const avail = availableQtyForItem(item);
    if (avail <= 0) {
      if (requirements.sizeRequired && !item.size) {
        el.textContent = 'Select a size to check availability';
      } else if (requirements.colorRequired && !item.color) {
        el.textContent = 'Select a colour to check availability';
      } else {
        el.textContent = 'Unavailable for selected size/colour';
      }
      el.style.color = 'var(--danger)';
      // ensure selectors are rebuilt to empty lists
      rebuildItemSelectors(index);
    } else {
      if ((requirements.sizeRequired && !item.size) || (requirements.colorRequired && !item.color)) {
        el.textContent = `Available: ${avail} pending variant selection`;
      } else {
        el.textContent = `Available: ${avail}`;
      }
      // rebuild lists to reflect current selection constraints
      rebuildItemSelectors(index);
      // if qty exceeds available, visually indicate
      const warning = avail > 0 && item.qty > avail;
      if (warning) {
        el.style.color = 'var(--danger)';
      } else {
        el.style.color = 'var(--text-muted)';
      }
    }
  });
}
function recalcTotals() {
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const shippingSelect = document.getElementById("shippingMethod");
  const shipping = 500;
  const misc = 100;
  const paystackFee = Math.ceil((subtotal + shipping + misc) * 0.015);
  const txn = misc + paystackFee;
  const total = subtotal + shipping + txn;

  if (sumSubtotalEl) sumSubtotalEl.textContent = moneyFmt(subtotal);
  if (sumShippingEl) sumShippingEl.textContent = moneyFmt(shipping);
  if (sumTxnEl) sumTxnEl.textContent = moneyFmt(txn);
  if (sumTotalEl) sumTotalEl.textContent = moneyFmt(total);
  if (checkoutTotalEl) checkoutTotalEl.textContent = moneyFmt(total);

  return { subtotal, shipping, misc, paystackFee, txn, total };
}

function persistLocalCartIfNotSharedView() {
  if (!isSharedView) saveCartToStorage(cartItems);
}

cartListEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-index]");
  if (!btn) return;
  const index = Number(btn.dataset.index);
  const action = btn.dataset.action;

  if (btn.classList.contains("remove-btn")) {
    cartItems.splice(index, 1);
    persistLocalCartIfNotSharedView();
    renderCart();
    return;
  }

  if (action === "inc") {
    // check availability for this combination before increasing
    const avail = availableQtyForItem(cartItems[index]);
    if (avail > 0 && cartItems[index].qty + 1 > avail) {
      toast(`Only ${avail} unit(s) available for this size/colour`);
      return;
    }
    cartItems[index].qty += 1;
    persistLocalCartIfNotSharedView();
    renderCart();
  } else if (action === "dec") {
    cartItems[index].qty = Math.max(1, cartItems[index].qty - 1);
    persistLocalCartIfNotSharedView();
    renderCart();
  }
});

clearCartBtn?.addEventListener("click", () => {
  if (isSharedView) return;
  if (!confirm("Clear all items from your cart?")) return;
  cartItems = [];
  saveCartToStorage([]);
  renderCart();
  toast("Cart cleared");
});

copyToMyCartBtn?.addEventListener("click", () => {
  const local = getCartFromStorage().map(normalizeItem);
  const merged = [...local, ...cartItems.map((i) => ({ ...i, cartKey: `${i.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }))];
  saveCartToStorage(merged);
  toast("Items copied to your cart");
});

function openModal(el) {
  if (!el) return;
  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");
}

function closeModal(el) {
  if (!el) return;
  el.classList.remove("show");
  el.setAttribute("aria-hidden", "true");
}

function prefillPayerFromUser() {
  const payerName = document.getElementById("payerName");
  const payerEmail = document.getElementById("payerEmail");
  if (currentUser?.displayName && payerName && !payerName.value) payerName.value = currentUser.displayName;
  if (currentUser?.email && payerEmail && !payerEmail.value) payerEmail.value = currentUser.email;
}

function prefillRecipientFromShared() {
  const r = sharedCartMeta?.recipient || {};
  const fields = [
    ["recipientName", r.name],
    ["recipientPhone", r.phone],
    ["recipientEmail", r.email],
    ["recipientAddress", r.address]
  ];
  fields.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val && !el.value) el.value = val;
  });
}

function collectItemOptions() {
  cartItems = cartItems.map((item, index) => {
    const size = document.getElementById(`itemSize-${index}`)?.value?.trim() || item.size || "";
    const color = document.getElementById(`itemColor-${index}`)?.value?.trim() || item.color || "";
    const notes = document.getElementById(`itemNotes-${index}`)?.value?.trim() || item.notes || "";
    return { ...item, size, color, notes };
  });
  // ensure quantities do not exceed available stock for selected size/color
  for (const it of cartItems) {
    const avail = availableQtyForItem(it);
    if (it.qty > avail) {
      alert(`Requested ${it.qty} of "${it.name}" but only ${avail} available for the selected size/colour.`);
      return false;
    }
  }
  persistLocalCartIfNotSharedView();
  return true;
}

shareCartBtn?.addEventListener("click", () => {
  if (!cartItems.length) return;
  const ownerName = document.getElementById("shareOwnerName");
  const ownerEmail = document.getElementById("shareOwnerEmail");
  if (currentUser?.displayName && ownerName) ownerName.value = currentUser.displayName;
  if (currentUser?.email && ownerEmail) ownerEmail.value = currentUser.email;
  openModal(shareModal);
});

document.getElementById("cancelShare")?.addEventListener("click", () => closeModal(shareModal));

document.getElementById("confirmShare")?.addEventListener("click", async () => {
  const owner = {
    name: document.getElementById("shareOwnerName")?.value?.trim() || "",
    email: document.getElementById("shareOwnerEmail")?.value?.trim() || "",
    phone: document.getElementById("shareOwnerPhone")?.value?.trim() || ""
  };
  const recipient = {
    name: document.getElementById("shareRecipientName")?.value?.trim() || "",
    email: document.getElementById("shareRecipientEmail")?.value?.trim() || "",
    phone: document.getElementById("shareRecipientPhone")?.value?.trim() || "",
    address: document.getElementById("shareRecipientAddress")?.value?.trim() || ""
  };
  const message = document.getElementById("shareMessage")?.value?.trim() || "";

  if (!owner.name || !owner.email) {
    alert("Please enter your name and email so the recipient knows who shared this cart.");
    return;
  }

  const shareId = generateShareId();
  const payload = {
    items: cartItems,
    owner,
    recipient,
    message,
    createdAt: new Date().toISOString(),
    itemCount: cartItems.reduce((s, i) => s + i.qty, 0)
  };

  try {
    if (db) {
      await setDoc(doc(db, "sharedCarts", shareId), payload);
    } else {
      throw new Error("offline");
    }
  } catch (err) {
    console.warn(err);
    alert("Could not save shared cart online. Check your connection and try again.");
    return;
  }

  const url = `${location.origin}/cart.html?cart=${encodeURIComponent(shareId)}`;
  const shareText = `${owner.name} shared a cart with you on ${APP_NAME} 🛒\n${url}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: `Cart from ${owner.name}`, text: shareText, url });
    } else {
      await navigator.clipboard.writeText(shareText);
      toast("Share link copied to clipboard");
    }
  } catch {
    await navigator.clipboard.writeText(shareText);
    toast("Share link copied to clipboard");
  }

  const linkField = document.getElementById("shareLinkField");
  if (linkField) {
    linkField.value = url;
    linkField.closest(".share-link-row")?.removeAttribute("hidden");
  }

  closeModal(shareModal);
});

checkoutBtn?.addEventListener("click", async () => {
  if (!cartItems.length) return;
  // refresh product data to ensure availability checks use latest values
  await fetchProductDetailsForCart();
  renderCart();
  prefillPayerFromUser();
  prefillRecipientFromShared();
  const recipientFields = document.getElementById("recipientFields");
  const hasSharedRecipient = Boolean(sharedCartMeta?.recipient?.name || sharedCartMeta?.recipient?.address);
  if (hasSharedRecipient) {
    const recipientRadio = document.querySelector('input[name="deliveryTarget"][value="recipient"]');
    if (recipientRadio) recipientRadio.checked = true;
    if (recipientFields) recipientFields.hidden = false;
  } else {
    const payerRadio = document.querySelector('input[name="deliveryTarget"][value="payer"]');
    if (payerRadio) payerRadio.checked = true;
    if (recipientFields) recipientFields.hidden = true;
  }
  recalcTotals();
  openModal(checkoutModal);
});

document.getElementById("shippingMethod")?.addEventListener("change", recalcTotals);

document.getElementById("cancelCheckout")?.addEventListener("click", () => closeModal(checkoutModal));

document.querySelectorAll('input[name="deliveryTarget"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const recipientFields = document.getElementById("recipientFields");
    const useRecipient = document.querySelector('input[name="deliveryTarget"]:checked')?.value === "recipient";
    if (recipientFields) recipientFields.hidden = !useRecipient;
  });
});

// live update when user edits item-specific options in checkout
itemOptionListEl?.addEventListener('input', (e) => {
  const card = e.target.closest && e.target.closest('.item-detail-card');
  if (!card) return;
  const idx = Number(card.dataset.index);
  if (Number.isNaN(idx)) return;
  const size = document.getElementById(`itemSize-${idx}`)?.value?.trim() || '';
  const color = document.getElementById(`itemColor-${idx}`)?.value?.trim() || '';
  const notes = document.getElementById(`itemNotes-${idx}`)?.value?.trim() || '';
  cartItems[idx] = { ...cartItems[idx], size, color, notes };
  persistLocalCartIfNotSharedView();
  updateStockHints();
});

// helper: compute available sizes/colors from variant matrix
function getAvailableSizesFromMatrix(matrix, stockQty, color) {
  const seen = new Set();
  const out = [];
  (matrix || []).forEach(r => {
    const s = (r.size || '').trim();
    const qty = (r.qty != null) ? Number(r.qty) : Number(stockQty || 0);
    if (!s) return;
    if (color && (r.color || '').trim() !== color) return;
    if (qty <= 0) return;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  });
  return out;
}

function getAvailableColorsFromMatrix(matrix, stockQty, size) {
  const seen = new Set();
  const out = [];
  (matrix || []).forEach(r => {
    const c = (r.color || '').trim();
    const qty = (r.qty != null) ? Number(r.qty) : Number(stockQty || 0);
    if (!c) return;
    if (size && (r.size || '').trim() !== size) return;
    if (qty <= 0) return;
    if (!seen.has(c)) { seen.add(c); out.push(c); }
  });
  return out;
}

function rebuildItemSelectors(idx) {
  const item = cartItems[idx];
  if (!item) return;
  const matrix = window.ProductOptions ? window.ProductOptions.resolveVariantMatrix(item) : (item.variantMatrix || []);
  const stockQty = Number(item.stockQty || 0);

  const sizeEl = document.getElementById(`itemSize-${idx}`);
  const colorEl = document.getElementById(`itemColor-${idx}`);

  const selectedSize = sizeEl?.value || '';
  const selectedColor = colorEl?.value || '';

  let sizes = getAvailableSizesFromMatrix(matrix, stockQty, selectedColor);
  let colors = getAvailableColorsFromMatrix(matrix, stockQty, selectedSize);
  if (selectedSize && !sizes.includes(selectedSize)) sizes = [selectedSize, ...sizes];
  if (selectedColor && !colors.includes(selectedColor)) colors = [selectedColor, ...colors];

  if (sizeEl) {
    const prev = sizeEl.value;
    if (sizes.length) {
      sizeEl.innerHTML = `<option value="" disabled ${!prev ? 'selected' : ''}>Select size</option>` + sizes.map(s => `<option value="${escapeHtml(s)}" ${s===prev? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
      sizeEl.disabled = false;
    } else {
      sizeEl.innerHTML = `<option value="" disabled selected>No sizes available</option>`;
      sizeEl.disabled = true;
    }
  }
  if (colorEl) {
    const prevc = colorEl.value;
    if (colors.length) {
      colorEl.innerHTML = `<option value="" disabled ${!prevc ? 'selected' : ''}>Select colour</option>` + colors.map(c => `<option value="${escapeHtml(c)}" ${c===prevc? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      colorEl.disabled = false;
    } else {
      colorEl.innerHTML = `<option value="" disabled selected>No colours available</option>`;
      colorEl.disabled = true;
    }
  }

  // if no sizes and no colors, mark sold out overlay
  const avail = availableQtyForItem(item);
  const card = document.querySelector(`.item-detail-card[data-index="${idx}"]`);
  if (card) {
    const sold = card.querySelector('.sold-out');
    if (avail <= 0 && !sold) {
      const div = document.createElement('div');
      div.className = 'sold-out';
      div.textContent = 'SOLD OUT';
      div.style.position = 'absolute'; div.style.inset = '0'; div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center'; div.style.background = 'rgba(15,23,42,0.65)'; div.style.color = '#fff'; div.style.fontWeight = '800'; div.style.zIndex = '5'; div.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4)';
      card.prepend(div);
    } else if (avail > 0 && sold) {
      sold.remove();
    }
  }
}

itemOptionListEl?.addEventListener('change', (e) => {
  const card = e.target.closest && e.target.closest('.item-detail-card');
  if (!card) return;
  const idx = Number(card.dataset.index);
  if (Number.isNaN(idx)) return;
  // when size changes, rebuild colors; when color changes, rebuild sizes
  const id = e.target.id || '';
  if (id === `itemSize-${idx}`) {
    // update cart and rebuild color list
    cartItems[idx].size = e.target.value;
    persistLocalCartIfNotSharedView();
    rebuildItemSelectors(idx);
  }
  if (id === `itemColor-${idx}`) {
    cartItems[idx].color = e.target.value;
    persistLocalCartIfNotSharedView();
    rebuildItemSelectors(idx);
  }
  updateStockHints();
});

function getCustomerDetails(role) {
  if (role === "payer") {
    return {
      name: document.getElementById("payerName")?.value?.trim() || "",
      phone: document.getElementById("payerPhone")?.value?.trim() || "",
      email: document.getElementById("payerEmail")?.value?.trim() || "",
      address: document.getElementById("payerAddress")?.value?.trim() || ""
    };
  }
  return {
    name: document.getElementById("recipientName")?.value?.trim() || "",
    phone: document.getElementById("recipientPhone")?.value?.trim() || "",
    email: document.getElementById("recipientEmail")?.value?.trim() || "",
    address: document.getElementById("recipientAddress")?.value?.trim() || ""
  };
}

async function verifyPaystackPayment(reference, amountKobo, email) {
  try {
    const res = await fetch("/api/verifyPayment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, amount: amountKobo, email })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      console.warn("Verification request failed", res.status, errorData);
      return false;
    }

    const data = await res.json();
    const paystackStatus = String(data?.data?.status || data?.status || "").toLowerCase();
    const verifiedAmount = Number(data?.data?.amount ?? data?.amount ?? 0);
    const isVerified = paystackStatus === "success" && verifiedAmount === amountKobo;
    if (!isVerified) {
      console.warn("Verification response:", data);
    }
    return isVerified;
  } catch (e) {
    console.warn("Payment verification unavailable", e);
    return false;
  }
}

function buildReceiptHtml(order, audience) {
  const isRecipient = audience === "recipient";
  const title = isRecipient ? "DELIVERY CONFIRMATION" : "PAYMENT RECEIPT";
  const customer = isRecipient ? order.deliveryCustomer : order.payer;
  const itemsHtml = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}${item.size || item.color || item.notes ? ` (${[item.size, item.color, item.notes].filter(Boolean).join(", ")})` : ""}</td>
      <td>${item.qty}</td>
      <td>${moneyFmt(item.price * item.qty)}</td>
    </tr>
  `).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;color:#111}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ddd;padding:8px;text-align:left}h2{color:#2563eb}</style></head><body>
  <h2>${title}</h2>
  <p><strong>Order ID:</strong> ${escapeHtml(order.orderId)}</p>
  <p><strong>${isRecipient ? "Deliver to" : "Paid by"}:</strong> ${escapeHtml(customer.name)}</p>
  <p><strong>Phone:</strong> ${escapeHtml(customer.phone)}</p>
  <p><strong>Email:</strong> ${escapeHtml(customer.email)}</p>
  <p><strong>Address:</strong> ${escapeHtml(customer.address)}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table>
  <p><strong>Shipping:</strong> ${escapeHtml(order.shippingMethod)} (${moneyFmt(order.shippingFee)})</p>
  <p><strong>Total:</strong> ${moneyFmt(order.total)}</p>
  <p><strong>Reference:</strong> ${escapeHtml(order.paystackRef || "N/A")}</p>
  <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
  <footer><strong>Issued by ${APP_NAME}</strong></footer>
  </body></html>`;
}

function downloadHtmlReceipt(html, filename) {
  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function saveCustomerNotifications(order) {
  if (!db) return;
  const notifications = [
    {
      orderId: order.orderId,
      role: "payer",
      email: order.payer.email,
      phone: order.payer.phone,
      name: order.payer.name,
      subject: `Your ${APP_NAME} order confirmation`,
      summary: `${order.items.length} item(s) — ${moneyFmt(order.total)}`,
      status: "pending",
      createdAt: serverTimestamp()
    },
    {
      orderId: order.orderId,
      role: "recipient",
      email: order.deliveryCustomer.email,
      phone: order.deliveryCustomer.phone,
      name: order.deliveryCustomer.name,
      subject: `Delivery details for your ${APP_NAME} order`,
      summary: `${order.items.length} item(s) shipping to you`,
      status: "pending",
      createdAt: serverTimestamp()
    }
  ];

  for (const note of notifications) {
    if (note.email || note.phone) {
      await addDoc(collection(db, "customerNotifications"), note);
    }
  }
}

document.getElementById("payNow")?.addEventListener("click", async () => {
  const payer = getCustomerDetails("payer");
  if (!payer.name || !payer.phone || !payer.email || !payer.address) {
    alert("Please fill in all payer details (name, phone, email, address).");
    return;
  }

  const deliveryTarget = document.querySelector('input[name="deliveryTarget"]:checked')?.value || "payer";
  const deliveryCustomer = deliveryTarget === "recipient" ? getCustomerDetails("recipient") : { ...payer };

  if (deliveryTarget === "recipient") {
    if (!deliveryCustomer.name || !deliveryCustomer.phone || !deliveryCustomer.email || !deliveryCustomer.address) {
      alert("Please fill in all recipient delivery details.");
      return;
    }
  }

  if (!collectItemOptions()) return;
  const missingItemDetails = cartItems.some((item) => {
    const requirements = getItemOptionRequirements(item);
    return (requirements.sizeRequired && !item.size) || (requirements.colorRequired && !item.color);
  });
  if (missingItemDetails) {
    alert("Please provide size and colour for every item before checkout.");
    return;
  }

  const totals = recalcTotals();
  const shippingMethod = document.getElementById("shippingMethod")?.value || "pickup";
  const note = document.getElementById("orderNote")?.value?.trim() || "";
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

  const order = {
    orderId,
    type: "cart_checkout",
    userId: currentUser?.uid || null,
    payerUid: currentUser?.uid || null,
    payerEmail: payer.email,
    payer,
    deliveryTarget,
    deliveryCustomer,
    items: cartItems.map(({ id, name, price, qty, image, images, type, size, color, notes, supplierEmail, supplierName }) => ({
      id,
      name,
      price: Number(price),
      qty,
      image,
      images,
      type,
      size,
      color,
      notes: notes || "",
      supplierEmail,
      supplierName,
      status: "pending"
    })),
    sharedCartId,
    shippingMethod,
    shippingFee: totals.shipping,
    miscFee: totals.misc,
    paystackFee: totals.paystackFee,
    transactionFee: totals.txn,
    note,
    subtotal: totals.subtotal,
    total: totals.total,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  if (typeof PaystackPop === "undefined") {
    alert("Paystack is not loaded. Please refresh and try again.");
    return;
  }

  const amountKobo = Math.round(order.total * 100);

  PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: payer.email,
    amount: amountKobo,
    currency: "NGN",
    metadata: {
      custom_fields: [
        { display_name: "Order ID", variable_name: "order_id", value: orderId },
        { display_name: "Items", variable_name: "items", value: String(order.items.length) }
      ]
    },
    callback(response) {
      (async () => {
        order.paystackRef = response.reference;
        const verified = await verifyPaystackPayment(response.reference, amountKobo, payer.email);
        if (!verified) {
          alert("Payment verification failed. Contact support with reference: " + response.reference);
          return;
        }

        order.status = "paid";
        order.paymentVerified = true;
        order.paymentVerification = {
          reference: response.reference,
          amountKobo,
          email: payer.email,
          verifiedAt: new Date().toISOString()
        };
        persistOrderLocally(order);

        try {
          if (db) {
            await addDoc(collection(db, "orders"), {
              ...order,
              paymentVerified: true,
              paymentVerification: order.paymentVerification,
              createdAt: serverTimestamp()
            });
            await saveCustomerNotifications(order);
          } else {
            throw new Error("no db");
          }
        } catch (e) {
          console.warn("Firestore save failed", e);
          persistOrderLocally(order);
        }

        downloadHtmlReceipt(buildReceiptHtml(order, "payer"), `tucks-receipt-${orderId}.html`);
        if (deliveryTarget === "recipient" && deliveryCustomer.email !== payer.email) {
          downloadHtmlReceipt(buildReceiptHtml(order, "recipient"), `tucks-delivery-${orderId}.html`);
        }

        if (!isSharedView) {
          cartItems = [];
          saveCartToStorage([]);
        }
        renderCart();
        closeModal(checkoutModal);

        const confirmContent = document.getElementById("confirmContent");
        if (confirmContent) {
          confirmContent.innerHTML = `
            <p>Payment successful. Reference: <strong>${escapeHtml(response.reference)}</strong></p>
            <p>Total: <strong>${moneyFmt(order.total)}</strong></p>
            <p>Delivery: <strong>${deliveryTarget === "recipient" ? escapeHtml(deliveryCustomer.name) : "You (payer)"}</strong></p>
            <p>Receipt downloaded. Order details queued for payer and recipient.</p>
          `;
        }
        openModal(confirmModal);
      })();
    },
    onClose() {
      toast("Payment cancelled");
    }
  }).openIframe();
});

document.getElementById("closeConfirm")?.addEventListener("click", () => closeModal(confirmModal));

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  [shareModal, checkoutModal, confirmModal].forEach(closeModal);
});

initCart();

// expose helpers for debugging and manual re-rendering when loaded as file://
try {
  window.tucks_initCart = initCart;
  window.tucks_renderCart = renderCart;
  window.tucks_getCartItems = () => (typeof cartItems !== 'undefined' ? cartItems : []);
} catch (e) {
  // ignore in non-browser contexts
}
