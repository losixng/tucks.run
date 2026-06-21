let walletBalance = 0;
let isProcessing = false;

const buyModal = document.getElementById('buyModal');
const bmThumb = document.getElementById('bmThumb');
const bmTitle = document.getElementById('bmTitle');
const bmPrice = document.getElementById('bmPrice');
const bmName = document.getElementById('buyerName');
const bmPhone = document.getElementById('buyerPhone');
const bmEmail = document.getElementById('buyerEmail');
const bmAddress = document.getElementById('buyerAddress');
const bmNote = document.getElementById('buyerNote');
const bmShipping = document.getElementById('buyerShipping');
const sumProduct = document.getElementById('sumProduct');
const sumShipping = document.getElementById('sumShipping');
const sumTxn = document.getElementById('sumTxn');
const sumTotal = document.getElementById('sumTotal');
const payNow = document.getElementById('payNow');
const walletBtn = document.getElementById('walletPayBtn');
const cancelBuy = document.getElementById('cancelBuy');



const db = window.db;
const auth = window.auth;
if (!db || !auth) {
  console.error("Please contact Losix Team for more details");
}

// 🔥 UID-BASED + REAL-TIME WALLET
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const userRef = window.doc(db, "users", user.uid);

  // 🔄 AUTO-CREATE USER DOC IF NOT EXISTS
  window.onSnapshot(userRef, async (snap) => {

    if (!snap.exists()) {
      alert("Error initializing account...");

      await window.setDoc(userRef, {
        email: user.email,
        walletBalance: 0
      });

      return;
    }

const data = snap.data();

    walletBalance = Number(data.walletBalance || 0);

    const el = document.getElementById("walletBalance");
    if (el) {
      el.textContent = "₦" + walletBalance.toLocaleString();
    }

    // ✅ SAVE REFERENCE
    window.userDocRef = userRef;
  });
});


// 💰 SECURE WALLET PAYMENT (TRANSACTION)
document.getElementById("walletPayBtn")?.addEventListener("click", async () => {

  if (isProcessing) return;
  isProcessing = true;

  if (!window.currentItem) {
    alert("Please select a product first");
    isProcessing = false;
    return;
  }

  const totalsRaw = window.recalcTotals();

  const totals = {
    ...totalsRaw,
    total: totalsRaw.total > 10000000000000
      ? totalsRaw.total / 100
      : totalsRaw.total
  };


  try {
    const userRef = window.userDocRef;

    // 🔐 FIRESTORE TRANSACTION (CRITICAL)
    await window.runTransaction(db, async (transaction) => {

      const docSnap = await transaction.get(userRef);

      if (!docSnap.exists()) {
        throw "User not found";
      }

      const currentBalance = docSnap.data().walletBalance || 0;

      if (currentBalance < totals.total) {
        throw `Insufficient Balance: ₦${currentBalance}`;
      }

      const newBalance = currentBalance - totals.total;

      // ✅ SAFE UPDATE
      transaction.update(userRef, {
        walletBalance: newBalance
      });
    });

    // ✅ SAVE FULL ORDER AFTER SUCCESS

// 🔥 GET FORM VALUES (SAME AS RECEIPT LOGIC)
const name = bmName.value.trim();
const phone = bmPhone.value.trim();
const email = bmEmail.value.trim();
const address = bmAddress.value.trim();
// 🔥 ADD THIS BLOCK (THIS WAS MISSING)
  const category = document.getElementById("productCategory")?.value || "";
  const customSize = document.getElementById("customSize")?.value.trim() || "";
  const color = document.getElementById("buyerColor")?.value || "";
  const fit = document.getElementById("buyerFit")?.value || "";
  const size = document.getElementById("sizeOptions")?.value || "";

  const finalSize = customSize || selectedSize;


walletPayBtn?.addEventListener('click', async ()=>{
  if(!currentItem) return;
  const name = bmName?.value?.trim(); const phone = bmPhone?.value?.trim();
  const email = bmEmail?.value?.trim(); const address = bmAddress?.value?.trim();
  const note = bmNote?.value?.trim() || '';
  if(!name || !phone || !email || !address) { alert('Please fill name, phone, email and address'); return; }
  const totals = recalcTotals();
  if(!totals) return;
  });

// 🔥 BUILD FULL ORDER OBJECT
const order = {
  userId: auth.currentUser.uid,

  customer: {
    name,
    phone,
    email,
    address
  },

  product: {
    id: currentItem.id,
    name: currentItem.name,
    price: Number(currentItem.price),
    images: currentItem.images || []
  },

  shippingMethod: bmShipping.value,
  // 🔥 NEW SMART FIELDS
  category: category,
  size: finalSize || null,
  color: color || null,
  fit: fit || null,
  shippingFee: totals.shipping || 0,
  transactionFee: totals.txn || 0,
  customizeFee: 0,
  productSize : size ||null,

  total: totals.total,

  paymentMethod: "wallet",
  status: 'Pending',

  // 🔐 EXTRA SECURITY TRACKING
  transactionId: "TX-" + Date.now(),
  balanceBefore: walletBalance,
  balanceAfter: walletBalance - totals.total,

  createdAt: new Date()
};

// 💾 SAVE TO FIRESTORE
await window.addDoc(
  window.collection(db, "walletPayments"),
  order
);
    hideModal(buyModal);
    alert("✅ Paid with wallet");

  } catch (err) {
    console.error(err)
    alert("An error occured...");
  }

  isProcessing = false;
});