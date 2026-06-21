import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzwnmGgEcN63RcCHSNU6p_xXKxmeqzF6k",
  authDomain: "losixmarket.firebaseapp.com",
  projectId: "losixmarket",
  storageBucket: "losixmarket.firebasestorage.app",
  messagingSenderId: "301860246689",
  appId: "1:301860246689:web:aabf0ab9af41081a91cce0",
  measurementId: "G-ZPVVZ8GNP0"
};

const STORAGE_KEY = 'vendorApplications';
const COLLECTION_NAME = 'vendorApplications';
let db = null;

try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  console.info('Vendor registration Firestore initialized.');
} catch (error) {
  console.warn('Could not initialize Firestore for vendor registration', error);
  db = null;
}

function normalizeDate(value) {
  if (!value) return new Date().toLocaleString();
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString();
  }
  return new Date(value).toLocaleString();
}

async function getVendorApplications() {
  if (db) {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Could not fetch vendor applications from Firestore', error);
    }
  }

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('Error reading vendor applications from local storage', error);
    return [];
  }
}

async function saveVendorApplication(application) {
  const payload = {
    ...application,
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      await addDoc(collection(db, COLLECTION_NAME), {
        ...application,
        createdAt: serverTimestamp()
      });
      return payload;
    } catch (error) {
      console.warn('Could not save vendor application to Firestore', error);
    }
  }

  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    current.unshift(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return payload;
  } catch (error) {
    console.error('Could not save vendor application locally', error);
    throw error;
  }
}

function renderVendorApplications(container, applications) {
  container.innerHTML = '';
  if (!applications.length) {
    container.innerHTML = '<div class="empty-state">No vendor applications have been submitted yet.</div>';
    return;
  }

  applications.forEach((app, index) => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-head">
        <div>
          <h4>${index + 1}. ${app.fullName || 'Unnamed vendor'}</h4>
          <div style="font-size:0.88rem;color:var(--text-muted);margin-top:4px">Submitted: ${normalizeDate(app.createdAt)}</div>
        </div>
        <span class="status-pill pending">New</span>
      </div>
      <div style="margin-top:12px;display:grid;gap:10px">
        <div><strong>Email:</strong> ${app.email || '—'}</div>
        <div><strong>Phone:</strong> ${app.phone || '—'}</div>
        <div><strong>University:</strong> ${app.university || '—'}</div>
        <div><strong>Matric/NIN:</strong> ${app.studentId || '—'}</div>
        <div><strong>Level:</strong> ${app.level || '—'}</div>
        <div><strong>Business:</strong> ${app.businessName || '—'}</div>
        <div><strong>Products:</strong> ${app.products || '—'}</div>
        <div><strong>Bank:</strong> ${app.bankName || '—'} (${app.bankNumber || '—'})</div>
        <div><strong>Handling/delivery:</strong> ${app.deliveryNote || '—'}</div>
        ${app.imageDataUrl ? `<div style="margin-top:12px;"><strong>Uploaded image:</strong><div style="margin-top:8px;"><img src="${app.imageDataUrl}" alt="Vendor upload" style="width:100%;max-width:420px;border-radius:18px;object-fit:cover;border:1px solid rgba(148,163,184,0.35);" /></div></div>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

export { getVendorApplications, saveVendorApplication, renderVendorApplications };

