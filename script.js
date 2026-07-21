import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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
let authReady = false;
let userProfile = null;
const USER_PROFILE_KEY = "tucksUserProfile";
const PUSH_BUTTON_ID = "tucksPushNotificationButton";
const PUSH_TOAST_ID = "tucksPushNotificationToast";
let pushToastTimer = null;

function ensurePushNotificationStyles() {
  if (document.getElementById("tucksPushNotificationStyles")) return;
  const style = document.createElement("style");
  style.id = "tucksPushNotificationStyles";
  style.textContent = `
    #${PUSH_BUTTON_ID} {
      position: fixed;
      right: 16px;
      bottom: 88px;
      z-index: 99999;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      font-size: 0.92rem;
      font-weight: 700;
      box-shadow: 0 10px 26px rgba(37, 99, 235, 0.26);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #${PUSH_BUTTON_ID}:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 30px rgba(37, 99, 235, 0.32);
    }
    #${PUSH_BUTTON_ID}.is-ready {
      background: linear-gradient(135deg, #16a34a, #15803d);
    }
    #${PUSH_BUTTON_ID}.is-blocked {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
    }
    #${PUSH_BUTTON_ID}.is-loading {
      opacity: 0.9;
      cursor: progress;
    }
    #${PUSH_TOAST_ID} {
      position: fixed;
      right: 16px;
      bottom: 24px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .tucks-push-toast {
      min-width: 260px;
      max-width: 320px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      border: 1px solid rgba(37, 99, 235, 0.16);
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: flex-start;
      gap: 10px;
      transform: translateY(14px);
      opacity: 0;
      animation: tucksToastIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      pointer-events: auto;
    }
    .tucks-push-toast.is-success {
      border-color: rgba(22, 163, 74, 0.2);
      background: linear-gradient(135deg, rgba(240, 253, 244, 0.98), rgba(255, 255, 255, 0.96));
    }
    .tucks-push-toast.is-error {
      border-color: rgba(220, 38, 38, 0.2);
      background: linear-gradient(135deg, rgba(254, 242, 242, 0.98), rgba(255, 255, 255, 0.96));
    }
    .tucks-push-toast.is-leaving {
      animation: tucksToastOut 0.24s ease forwards;
    }
    .tucks-push-toast-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
      font-size: 16px;
      flex-shrink: 0;
    }
    .tucks-push-toast.is-success .tucks-push-toast-icon {
      background: rgba(22, 163, 74, 0.12);
      color: #15803d;
    }
    .tucks-push-toast.is-error .tucks-push-toast-icon {
      background: rgba(220, 38, 38, 0.12);
      color: #dc2626;
    }
    .tucks-push-toast-title {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .tucks-push-toast-body {
      font-size: 0.9rem;
      line-height: 1.4;
      color: #475569;
    }
    @keyframes tucksToastIn {
      from { opacity: 0; transform: translateY(14px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes tucksToastOut {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(10px) scale(0.98); }
    }
    @media (max-width: 640px) {
      #${PUSH_BUTTON_ID} {
        right: 12px;
        bottom: 76px;
        padding: 9px 12px;
        font-size: 0.84rem;
      }
      #${PUSH_TOAST_ID} {
        left: 12px;
        right: 12px;
        bottom: 16px;
      }
      .tucks-push-toast {
        max-width: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensurePushNotificationToastContainer() {
  ensurePushNotificationStyles();
  if (document.getElementById(PUSH_TOAST_ID)) return document.getElementById(PUSH_TOAST_ID);
  const container = document.createElement("div");
  container.id = PUSH_TOAST_ID;
  document.body.appendChild(container);
  return container;
}

function showThemeNotification(title, message, kind = "info", timeout = 4200) {
  const container = ensurePushNotificationToastContainer();
  const toast = document.createElement("div");
  toast.className = `tucks-push-toast${kind === "success" ? " is-success" : kind === "error" ? " is-error" : ""}`;

  const icon = document.createElement("div");
  icon.className = "tucks-push-toast-icon";
  icon.textContent = kind === "success" ? "✨" : kind === "error" ? "⚠️" : "🔔";

  const content = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.className = "tucks-push-toast-title";
  titleEl.textContent = title;
  const bodyEl = document.createElement("div");
  bodyEl.className = "tucks-push-toast-body";
  bodyEl.textContent = message;
  content.append(titleEl, bodyEl);

  toast.append(icon, content);
  container.appendChild(toast);

  if (pushToastTimer) clearTimeout(pushToastTimer);
  pushToastTimer = window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 240);
  }, timeout);
}

function ensurePushNotificationButton() {
  ensurePushNotificationStyles();
  if (document.getElementById(PUSH_BUTTON_ID)) return document.getElementById(PUSH_BUTTON_ID);

  const button = document.createElement("button");
  button.id = PUSH_BUTTON_ID;
  button.type = "button";
  button.innerHTML = '<span>🔔</span><span>Enable notifications</span>';
  document.body.appendChild(button);
  return button;
}

function updatePushNotificationButtonState(button, state, label) {
  button.classList.remove("is-ready", "is-blocked", "is-loading");
  if (state === "ready") button.classList.add("is-ready");
  if (state === "blocked") button.classList.add("is-blocked");
  if (state === "loading") button.classList.add("is-loading");
  if (button.firstElementChild) {
    button.firstElementChild.textContent = state === "ready" ? "✅" : state === "blocked" ? "🚫" : "🔔";
  }
  if (button.lastElementChild) {
    button.lastElementChild.textContent = label;
  }
}

async function registerServiceWorkerForPush() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/service-worker.js");
    return navigator.serviceWorker.ready;
  } catch (error) {
    console.warn("Service worker registration failed", error);
    return null;
  }
}

async function enablePushNotifications(button) {
  if (!button) return;
  updatePushNotificationButtonState(button, "loading", "Enabling notifications...");

  try {
    await registerServiceWorkerForPush();
    const module = await import("/firebase-messaging.js");
    const result = await module.initializePushNotifications();

    if (result?.token) {
      updatePushNotificationButtonState(button, "ready", "Notifications enabled");
      showThemeNotification("Notifications are on", "You’ll now get Tucks updates and reminders.", "success");
      return;
    }

    if (Notification.permission === "denied") {
      updatePushNotificationButtonState(button, "blocked", "Notifications blocked");
      showThemeNotification("Notifications blocked", "You can re-enable them anytime in your browser settings.", "error");
      return;
    }

    updatePushNotificationButtonState(button, "ready", "Enable notifications");
  } catch (error) {
    console.warn("Could not enable push notifications", error);
    updatePushNotificationButtonState(button, "blocked", "Could not enable");
    showThemeNotification("Something went wrong", "We could not enable notifications right now. Please try again.", "error");
  }
}

function initializePushNotificationButton() {
  const button = ensurePushNotificationButton();
  if (!firebaseCurrentUser) {
    button.style.display = "none";
    return;
  }

  button.style.display = "inline-flex";
  button.onclick = () => enablePushNotifications(button);

  if (!("Notification" in window)) {
    updatePushNotificationButtonState(button, "blocked", "Notifications unavailable");
    return;
  }

  if (Notification.permission === "granted") {
    updatePushNotificationButtonState(button, "ready", "Notifications enabled");
    enablePushNotifications(button);
    return;
  }

  if (Notification.permission === "denied") {
    updatePushNotificationButtonState(button, "blocked", "Notifications blocked");
    return;
  }

  updatePushNotificationButtonState(button, "ready", "Enable notifications");
}

window.addEventListener("load", () => {
  initializePushNotificationButton();
});

function getLocalUserProfile() {
  try {
    return JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || "null") || null;
  } catch {
    return null;
  }
}

function saveLocalUserProfile(profile) {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile || {}));
  } catch (e) {
    console.warn("Could not save local user profile", e);
  }
}

async function saveUserProfileToFirestore(profile) {
  if (!db || !firebaseCurrentUser || !profile) return;
  try {
    await setDoc(doc(db, "userProfiles", firebaseCurrentUser.uid), {
      profile: { ...profile, updatedAt: serverTimestamp() },
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("Could not save user profile to Firestore", e);
  }
}

async function loadUserProfileFromFirestore() {
  if (!db || !firebaseCurrentUser) return null;
  try {
    const snap = await getDoc(doc(db, "userProfiles", firebaseCurrentUser.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.profile || null;
  } catch (e) {
    console.warn("Could not load user profile from Firestore", e);
    return null;
  }
}

function mergeUserProfile(localProfile, remoteProfile) {
  return {
    ...(localProfile || {}),
    ...(remoteProfile || {})
  };
}

async function syncUserProfile() {
  const localProfile = getLocalUserProfile() || {};
  if (!firebaseCurrentUser) {
    userProfile = localProfile;
    return;
  }

  const remoteProfile = await loadUserProfileFromFirestore();
  userProfile = mergeUserProfile(localProfile, remoteProfile);
  saveLocalUserProfile(userProfile);

  if (!remoteProfile && Object.keys(localProfile).length) {
    await saveUserProfileToFirestore(userProfile);
  }
}

function applyUserProfileToInputs() {
  const profile = userProfile || getLocalUserProfile() || {};
  const fieldMap = {
    buyerName: profile.name,
    payerName: profile.name,
    buyerPhone: profile.phone,
    payerPhone: profile.phone,
    buyerEmail: profile.email,
    payerEmail: profile.email,
    buyerAddress: profile.address,
    payerAddress: profile.address
  };

  Object.entries(fieldMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el || !value || el.value.trim()) return;
    el.value = value;
  });
}

function updateProfileField(id, value) {
  const fieldMap = {
    buyerName: "name",
    payerName: "name",
    buyerPhone: "phone",
    payerPhone: "phone",
    buyerEmail: "email",
    payerEmail: "email",
    buyerAddress: "address",
    payerAddress: "address"
  };
  const profileKey = fieldMap[id];
  if (!profileKey) return;
  if (!userProfile) userProfile = getLocalUserProfile() || {};
  if (value) {
    userProfile[profileKey] = value;
  } else {
    delete userProfile[profileKey];
  }
  saveLocalUserProfile(userProfile);
  saveUserProfileToFirestore(userProfile);
}

const AUTH_MODAL_ID = "tucksAuthModal";
let authModalMode = "login";
let authModalLocked = false;

function ensureAuthModalStyles() {
  if (document.getElementById("tucksAuthModalStyles")) return;
  const style = document.createElement("style");
  style.id = "tucksAuthModalStyles";
  style.textContent = `
    #${AUTH_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    }
    #${AUTH_MODAL_ID}.is-open {
      display: flex;
    }
    #${AUTH_MODAL_ID} .tucks-auth-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    #${AUTH_MODAL_ID} .tucks-auth-panel {
      position: relative;
      width: min(400px, 100%);
      max-height: min(90vh, 640px);
      overflow-y: auto;
      background: #f3f4f6;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
      padding: 28px 24px 24px;
      box-sizing: border-box;
      animation: tucksAuthIn 0.22s ease-out;
    }
    @keyframes tucksAuthIn {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    #${AUTH_MODAL_ID} .tucks-auth-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #64748b;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
    #${AUTH_MODAL_ID} .tucks-auth-close:hover {
      background: rgba(30, 58, 138, 0.08);
      color: #1e3a8a;
    }
    #${AUTH_MODAL_ID} .tucks-auth-title {
      margin: 0 28px 8px 0;
      text-align: center;
      color: #1e3a8a;
      font-size: 1.35rem;
      font-weight: 700;
    }
    #${AUTH_MODAL_ID} .tucks-auth-sub {
      margin: 0 0 18px;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
    }
    #${AUTH_MODAL_ID} .tucks-auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 4px;
      margin-bottom: 18px;
      background: #e5e7eb;
      border-radius: 10px;
    }
    #${AUTH_MODAL_ID} .tucks-auth-tab {
      border: none;
      background: transparent;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
    }
    #${AUTH_MODAL_ID} .tucks-auth-tab.is-active {
      background: #fff;
      color: #1e3a8a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    #${AUTH_MODAL_ID} .tucks-auth-error {
      color: #dc2626;
      font-size: 13px;
      text-align: center;
      min-height: 1.2em;
      margin-bottom: 10px;
    }
    #${AUTH_MODAL_ID} .tucks-auth-social {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }
    #${AUTH_MODAL_ID} .tucks-auth-social-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 10px;
      border-radius: 8px;
      border: 1px solid #ddd;
      background: #fff;
      color: #333;
      font-size: 14px;
      cursor: pointer;
    }
    #${AUTH_MODAL_ID} .tucks-auth-social-btn:hover {
      background: #fafafa;
      border-color: #999;
    }
    #${AUTH_MODAL_ID} .tucks-auth-social-btn.apple {
      background: #000;
      color: #fff;
      border-color: #000;
    }
    #${AUTH_MODAL_ID} .tucks-auth-social-btn.apple:hover {
      background: #333;
    }
    #${AUTH_MODAL_ID} .tucks-auth-social-btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    #${AUTH_MODAL_ID} .tucks-auth-divider {
      display: flex;
      align-items: center;
      margin: 4px 0 16px;
      color: #999;
      font-size: 13px;
    }
    #${AUTH_MODAL_ID} .tucks-auth-divider::before,
    #${AUTH_MODAL_ID} .tucks-auth-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #ccc;
    }
    #${AUTH_MODAL_ID} .tucks-auth-divider::before { margin-right: 10px; }
    #${AUTH_MODAL_ID} .tucks-auth-divider::after { margin-left: 10px; }
    #${AUTH_MODAL_ID} .tucks-auth-input {
      width: 100%;
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 8px;
      border: 1px solid #ccc;
      font-size: 14px;
      box-sizing: border-box;
      background: #fff;
    }
    #${AUTH_MODAL_ID} .tucks-auth-submit {
      width: 100%;
      padding: 12px;
      background: #1e3a8a;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    #${AUTH_MODAL_ID} .tucks-auth-submit:hover {
      background: #2563eb;
    }
    #${AUTH_MODAL_ID} .tucks-auth-submit:disabled {
      opacity: 0.7;
      cursor: wait;
    }
    #${AUTH_MODAL_ID} .tucks-auth-footnote {
      margin-top: 14px;
      text-align: center;
      font-size: 13px;
      color: #64748b;
      line-height: 1.45;
    }
    #${AUTH_MODAL_ID} .tucks-auth-footnote a {
      color: #1e3a8a;
      font-weight: 600;
      text-decoration: none;
    }
    #${AUTH_MODAL_ID} .tucks-auth-link {
      display: block;
      width: 100%;
      margin: -4px 0 10px;
      border: none;
      background: transparent;
      color: #1e3a8a;
      font-size: 13px;
      font-weight: 600;
      text-align: right;
      cursor: pointer;
      padding: 0;
    }
    #${AUTH_MODAL_ID} .tucks-auth-error.is-success {
      color: #047857;
    }
    .tucks-product-skeleton-card {
      border-radius: 18px;
      padding: 14px;
      background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
      border: 1px solid rgba(30, 58, 138, 0.12);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
      min-height: 270px;
      position: relative;
      overflow: hidden;
      animation: tucksSkeletonPulse 1.2s ease-in-out infinite;
    }
    .tucks-product-skeleton-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 45%, transparent 100%);
      transform: translateX(-100%);
      animation: tucksSkeletonShimmer 1.25s linear infinite;
    }
    .tucks-product-skeleton-card .tucks-skel-line {
      height: 12px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.35);
      margin-bottom: 10px;
    }
    .tucks-product-skeleton-card .tucks-skel-line--sm { width: 55%; }
    .tucks-product-skeleton-card .tucks-skel-line--md { width: 80%; }
    .tucks-product-skeleton-card .tucks-skel-line--lg { width: 100%; }
    .tucks-product-skeleton-card .tucks-skel-thumb {
      height: 150px;
      border-radius: 14px;
      background: rgba(148, 163, 184, 0.2);
      margin-bottom: 12px;
      position: relative;
      overflow: hidden;
    }
    .tucks-product-skeleton-card .tucks-skel-pill {
      width: 70px;
      height: 28px;
      border-radius: 999px;
      background: rgba(30, 58, 138, 0.16);
      margin-top: 10px;
    }
    @keyframes tucksSkeletonPulse {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }
    @keyframes tucksSkeletonShimmer {
      100% { transform: translateX(100%); }
    }
    body.tucks-auth-open {
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
}

function ensureAuthModal() {
  ensureAuthModalStyles();
  let modal = document.getElementById(AUTH_MODAL_ID);
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = AUTH_MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "tucksAuthTitle");
  modal.innerHTML = `
    <div class="tucks-auth-backdrop" data-auth-close="1"></div>
    <div class="tucks-auth-panel">
      <button type="button" class="tucks-auth-close" data-auth-close="1" aria-label="Close">&times;</button>
      <h2 class="tucks-auth-title" id="tucksAuthTitle">Welcome to Tucks</h2>
      <p class="tucks-auth-sub">Sign in to browse products and continue shopping.</p>
      <div class="tucks-auth-tabs" role="tablist">
        <button type="button" class="tucks-auth-tab is-active" data-auth-mode="login" role="tab">Log in</button>
        <button type="button" class="tucks-auth-tab" data-auth-mode="signup" role="tab">Sign up</button>
      </div>
      <div class="tucks-auth-error" id="tucksAuthError" aria-live="polite"></div>
      <div class="tucks-auth-social">
        <button type="button" class="tucks-auth-social-btn" data-auth-provider="google">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>
        <button type="button" class="tucks-auth-social-btn apple" data-auth-provider="apple">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.47 2.23-1.23 3.04-.79.84-2.1 1.49-3.2 1.4-.14-1.1.4-2.26 1.16-3.05.8-.86 2.2-1.48 3.27-1.39zM20.8 17.2c-.58 1.34-.86 1.93-1.61 3.11-1.05 1.62-2.53 3.64-4.37 3.66-1.63.03-2.05-1.07-4.27-1.05-2.21.01-2.68 1.09-4.31 1.06-1.84-.03-3.25-1.84-4.3-3.46C.5 17.9-.7 13.5.95 10.35c1.02-1.95 2.84-3.18 4.5-3.18 1.68 0 2.74 1.1 4.13 1.1 1.35 0 2.17-1.11 4.14-1.11 1.48 0 3.05.81 4.06 2.21-3.56 1.95-2.98 7.03 2.02 7.83z"/>
          </svg>
          Apple
        </button>
      </div>
      <div class="tucks-auth-divider">or</div>
      <input class="tucks-auth-input" type="email" id="tucksAuthEmail" placeholder="Email" autocomplete="email">
      <input class="tucks-auth-input" type="password" id="tucksAuthPassword" placeholder="Password" autocomplete="current-password">
      <button type="button" class="tucks-auth-link" id="tucksAuthForgotLink" data-auth-mode="forgot">Forgot password?</button>
      <button type="button" class="tucks-auth-submit" id="tucksAuthSubmit">Log in</button>
      <p class="tucks-auth-footnote" id="tucksAuthFootnote"></p>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-auth-close]")) {
      closeAuthModal();
      return;
    }
    const modeTarget = event.target.closest("[data-auth-mode]");
    if (modeTarget) {
      event.preventDefault();
      setAuthModalMode(modeTarget.getAttribute("data-auth-mode"));
      return;
    }
    const providerBtn = event.target.closest("[data-auth-provider]");
    if (providerBtn) {
      handleAuthProvider(providerBtn.getAttribute("data-auth-provider"));
      return;
    }
    if (event.target.id === "tucksAuthSubmit" || event.target.closest("#tucksAuthSubmit")) {
      handleAuthEmailSubmit();
    }
  });

  modal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("#tucksAuthEmail, #tucksAuthPassword")) {
      event.preventDefault();
      handleAuthEmailSubmit();
    }
  });

  document.body.appendChild(modal);
  return modal;
}

function setAuthModalMessage(message, kind = "error") {
  const errorEl = document.getElementById("tucksAuthError");
  if (!errorEl) return;
  errorEl.textContent = message || "";
  errorEl.classList.toggle("is-success", kind === "success");
  errorEl.classList.toggle("is-error", kind === "error" && !!(message || ""));
}

function setAuthModalError(message) {
  setAuthModalMessage(message, "error");
}

function setAuthModalBusy(busy) {
  const submit = document.getElementById("tucksAuthSubmit");
  const modal = document.getElementById(AUTH_MODAL_ID);
  if (submit) {
    submit.disabled = !!busy;
    submit.textContent = busy
      ? (authModalMode === "signup" ? "Creating account…" : "Signing in…")
      : (authModalMode === "signup" ? "Sign up" : "Log in");
  }
  if (modal) {
    modal.querySelectorAll("button, input").forEach((el) => {
      if (el.classList.contains("tucks-auth-close") || el.hasAttribute("data-auth-close")) return;
      if (el.id === "tucksAuthSubmit") return;
      el.disabled = !!busy;
    });
  }
}

function setAuthModalMode(mode) {
  authModalMode = mode === "signup" ? "signup" : mode === "forgot" ? "forgot" : "login";
  const modal = ensureAuthModal();
  modal.querySelectorAll("[data-auth-mode]").forEach((tab) => {
    const isActive = tab.getAttribute("data-auth-mode") === authModalMode;
    tab.classList.toggle("is-active", isActive);
  });
  const title = document.getElementById("tucksAuthTitle");
  const submit = document.getElementById("tucksAuthSubmit");
  const footnote = document.getElementById("tucksAuthFootnote");
  const password = document.getElementById("tucksAuthPassword");
  const forgotLink = document.getElementById("tucksAuthForgotLink");
  const isForgotMode = authModalMode === "forgot";
  if (title) title.textContent = authModalMode === "signup" ? "Create account" : isForgotMode ? "Reset password" : "Welcome to Tucks";
  if (submit) submit.textContent = authModalMode === "signup" ? "Sign up" : isForgotMode ? "Send reset link" : "Log in";
  if (password) {
    password.style.display = isForgotMode ? "none" : "";
    password.autocomplete = authModalMode === "signup" ? "new-password" : "current-password";
    password.value = "";
  }
  if (forgotLink) {
    forgotLink.style.display = authModalMode === "login" ? "block" : "none";
  }
  if (footnote) {
    if (authModalMode === "signup") {
      footnote.innerHTML = `Already have an account? <a href="#" data-auth-mode="login">Log in</a><br>By signing up you agree to our <a href="/profile/terms.html" target="_blank" rel="noopener">terms</a>.`;
    } else if (isForgotMode) {
      footnote.innerHTML = `Remembered your password? <a href="#" data-auth-mode="login">Log in</a>`;
    } else {
      footnote.innerHTML = `Don't have an account? <a href="#" data-auth-mode="signup">Sign up</a>`;
    }
  }
  setAuthModalMessage("");
}

function showAuthModal(mode = "login", lockModal = false) {
  if (window.location.pathname.endsWith("/login.html") || window.location.pathname.endsWith("/signup.html")) {
    return;
  }
  const modal = ensureAuthModal();
  authModalLocked = !!lockModal;
  setAuthModalMode(mode);
  setAuthModalBusy(false);
  modal.classList.add("is-open");
  document.body.classList.add("tucks-auth-open");
  const email = document.getElementById("tucksAuthEmail");
  if (email) setTimeout(() => email.focus(), 50);
}

function closeAuthModal(force = false) {
  if (authModalLocked && !force) return;
  const modal = document.getElementById(AUTH_MODAL_ID);
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.classList.remove("tucks-auth-open");
  authModalLocked = false;
  setAuthModalMessage("");
  setAuthModalBusy(false);
}

function finalizeAuthSuccess(message = "Welcome back! You are signed in and ready to explore.") {
  localStorage.setItem("isLoggedIn", "true");
  closeAuthModal(true);
  showThemeNotification("Welcome to Tucks", message, "success");
}

async function createUserDocument(user) {
  if (!db || !user) return;
  try {
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: user.displayName || "",
      walletBalance: 0,
      createdAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("Error creating user document:", error);
  }
}

function isIgnorableAuthError(error) {
  return error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request";
}

async function handleAuthProvider(providerName) {
  setAuthModalError("");
  setAuthModalBusy(true);
  try {
    let result;
    if (providerName === "google") {
      const provider = new GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");
      result = await signInWithPopup(auth, provider);
    } else if (providerName === "apple") {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      provider.setCustomParameters({ locale: "en" });
      result = await signInWithPopup(auth, provider);
    } else {
      return;
    }
    if (authModalMode === "signup" && result?.user) {
      await createUserDocument(result.user);
    }
    finalizeAuthSuccess(authModalMode === "signup" ? "Your account is ready. You can now shop, save favorites, and stay updated." : "You are signed in and ready to keep shopping.");
  } catch (error) {
    if (!isIgnorableAuthError(error)) {
      setAuthModalError(error.message || "Authentication failed.");
    }
  } finally {
    setAuthModalBusy(false);
  }
}

async function handleAuthEmailSubmit() {
  const email = document.getElementById("tucksAuthEmail")?.value?.trim() || "";
  const password = document.getElementById("tucksAuthPassword")?.value || "";
  setAuthModalError("");

  if (!email) {
    setAuthModalError("Please enter your email.");
    return;
  }

  if (authModalMode !== "forgot" && !password) {
    setAuthModalError("Please fill all fields.");
    return;
  }

  setAuthModalBusy(true);
  try {
    if (authModalMode === "signup") {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDocument(credential.user);
      finalizeAuthSuccess("Welcome aboard! Your account is ready and we’ll keep you posted with updates.");
    } else if (authModalMode === "forgot") {
      await sendPasswordResetEmail(auth, email);
      setAuthModalMessage("Password reset link sent. Check your inbox.", "success");
      setAuthModalMode("login");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      finalizeAuthSuccess("Welcome back! You’re signed in and ready to continue shopping.");
    }
  } catch (error) {
    setAuthModalError(error.message || "Authentication failed.");
  } finally {
    setAuthModalBusy(false);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const modal = document.getElementById(AUTH_MODAL_ID);
    if (modal?.classList.contains("is-open")) closeAuthModal();
  }
});

async function onProductTap(event) {
  if (firebaseCurrentUser) return;
  const cardElem = event.target.closest('.card, .product-card, .dept-card');
  if (cardElem && cardElem.closest('.product-grid, .dept-grid')) {
    event.preventDefault();
    event.stopPropagation();
    showAuthModal("login", true);
    return;
  }
  const a = event.target.closest && event.target.closest('a');
  if (a && anchorLooksLikeProduct(a.getAttribute('href') || a.href)) {
    event.preventDefault();
    event.stopPropagation();
    showAuthModal("login", true);
    return;
  }
  if (event.target.closest('#lbBuy') || event.target.closest('#payNow')) {
    event.preventDefault();
    event.stopPropagation();
    showAuthModal("login", true);
  }
}

// Also catch direct product links/anchors that navigate to product detail pages
function anchorLooksLikeProduct(href) {
  if (!href) return false;
  try {
    const u = href;
    if (typeof u === 'string' && (u.includes('product=') || u.includes('#product-'))) return true;
    for (const p of Object.values(PRODUCT_PAGES)) {
      if (String(href).includes(p)) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

// when user focuses any checkout/profile input, autofill known values
function onProfileFieldFocus(event) {
  const watched = ["buyerName","buyerPhone","buyerEmail","buyerAddress","payerName","payerPhone","payerEmail","payerAddress"];
  const id = event.target?.id;
  if (!id || !watched.includes(id)) return;
  applyUserProfileToInputs();
}

async function handleProfileInputEvent(event) {
  const id = event.target?.id;
  const watched = ["buyerName","buyerPhone","buyerEmail","buyerAddress","payerName","payerPhone","payerEmail","payerAddress"];
  if (!watched.includes(id)) return;
  updateProfileField(id, event.target.value?.trim() || "");
}

async function ensureProfileReady() {
  if (!authReady) return;
  applyUserProfileToInputs();
}

async function initProfileWatch() {
  document.addEventListener("input", handleProfileInputEvent, true);
  document.addEventListener("click", onProductTap, true);
  document.addEventListener('focusin', onProfileFieldFocus, true);
}

async function bootstrapProfileSupport() {
  await initProfileWatch();
}

bootstrapProfileSupport();

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
  authReady = true;
  if (user) {
    localStorage.setItem("isLoggedIn", "true");
    closeAuthModal();
    await loadRemoteCartForUser(user.uid);
  }
  await syncUserProfile();
  applyUserProfileToInputs();
  initializePushNotificationButton();
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

function ensureProductGridSkeletonStyles() {
  if (document.getElementById("tucksProductGridSkeletonStyles")) return;
  const style = document.createElement("style");
  style.id = "tucksProductGridSkeletonStyles";
  style.textContent = `
    .tucks-product-skeleton-card {
      border-radius: 18px;
      padding: 14px;
      background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
      border: 1px solid rgba(30, 58, 138, 0.12);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
      min-height: 270px;
      position: relative;
      overflow: hidden;
      animation: tucksSkeletonPulse 1.2s ease-in-out infinite;
    }
    .tucks-product-skeleton-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 45%, transparent 100%);
      transform: translateX(-100%);
      animation: tucksSkeletonShimmer 1.25s linear infinite;
    }
    .tucks-product-skeleton-card .tucks-skel-line {
      height: 12px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.35);
      margin-bottom: 10px;
    }
    .tucks-product-skeleton-card .tucks-skel-line--sm { width: 55%; }
    .tucks-product-skeleton-card .tucks-skel-line--md { width: 80%; }
    .tucks-product-skeleton-card .tucks-skel-line--lg { width: 100%; }
    .tucks-product-skeleton-card .tucks-skel-thumb {
      height: 150px;
      border-radius: 14px;
      background: rgba(148, 163, 184, 0.2);
      margin-bottom: 12px;
      position: relative;
      overflow: hidden;
    }
    .tucks-product-skeleton-card .tucks-skel-pill {
      width: 70px;
      height: 28px;
      border-radius: 999px;
      background: rgba(30, 58, 138, 0.16);
      margin-top: 10px;
    }
    @keyframes tucksSkeletonPulse {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }
    @keyframes tucksSkeletonShimmer {
      100% { transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);
}

function renderProductGridSkeletons() {
  ensureProductGridSkeletonStyles();
  document.querySelectorAll('.product-grid, .dept-grid').forEach((grid) => {
    if (grid.dataset.tucksSkeletonBound === '1') return;
    grid.dataset.tucksSkeletonBound = '1';

    const hasRealCards = () => grid.querySelector('.card, .product-card, .dept-card');
    const insertSkeletons = () => {
      if (hasRealCards() || grid.querySelector('.tucks-product-skeleton-card')) return;
      const count = Math.min(6, Number(grid.dataset.skeletonCount || 4));
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < count; index += 1) {
        const card = document.createElement('div');
        card.className = 'tucks-product-skeleton-card';
        card.innerHTML = `
          <div class="tucks-skel-thumb"></div>
          <div class="tucks-skel-line tucks-skel-line--md"></div>
          <div class="tucks-skel-line tucks-skel-line--sm"></div>
          <div class="tucks-skel-line tucks-skel-line--lg"></div>
          <div class="tucks-skel-pill"></div>`;
        fragment.appendChild(card);
      }
      grid.appendChild(fragment);
    };

    insertSkeletons();
    const observer = new MutationObserver(() => {
      if (hasRealCards()) {
        grid.querySelectorAll('.tucks-product-skeleton-card').forEach((el) => el.remove());
      } else if (!grid.querySelector('.tucks-product-skeleton-card')) {
        insertSkeletons();
      }
    });
    observer.observe(grid, { childList: true, subtree: true });
  });
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
  renderProductGridSkeletons();

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
