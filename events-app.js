import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

function money(value) {
  const amount = Number(value || 0);
  return currencyFormatter.format(amount);
}

function formatDateTime(value) {
  if (!value) return "Date pending";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatCountdown(target) {
  const end = target?.toDate ? target.toDate() : new Date(target);
  const diff = Math.max(0, end.getTime() - Date.now());
  const seconds = Math.floor(diff / 1000);
  const months = Math.floor(seconds / (60 * 60 * 24 * 30));
  const days = Math.floor((seconds % (60 * 60 * 24 * 30)) / (60 * 60 * 24));
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = seconds % 60;
  return { months, days, hours, minutes, secs };
}

function buildCountdownLabel(target) {
  const parts = formatCountdown(target);
  return `${parts.months}m ${parts.days}d ${parts.hours}h ${parts.minutes}m ${parts.secs}s`;
}

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return "";
  return user.getIdToken();
}

async function apiFetch(url, options = {}) {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, {
    ...options,
    headers
  });
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { raw: body };
  }
  if (!response.ok) {
    throw new Error(parsed?.message || parsed?.error || "Request failed");
  }
  return parsed;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstMedia(event) {
  const media = safeArray(event.mediaUrls);
  if (media.length) return media[0];
  if (event.imageUrl) return event.imageUrl;
  return "";
}

function resolveMediaMarkup(url) {
  if (!url) return "";
  const clean = String(url).trim();
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(clean)) {
    return `<video controls playsinline preload="metadata" src="${clean}"></video>`;
  }
  if (/youtube\.com|youtu\.be/i.test(clean)) {
    const match = clean.match(/(?:v=|youtu\.be\/)([\w-]+)/i);
    if (match) {
      return `<iframe src="https://www.youtube.com/embed/${match[1]}" allowfullscreen></iframe>`;
    }
  }
  return `<img src="${clean}" alt="">`;
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("eventFavorites") || "[]");
  } catch {
    return [];
  }
}

function setFavorites(value) {
  localStorage.setItem("eventFavorites", JSON.stringify(value));
}

function toggleFavorite(eventId) {
  const favorites = new Set(getFavorites());
  if (favorites.has(eventId)) {
    favorites.delete(eventId);
  } else {
    favorites.add(eventId);
  }
  setFavorites([...favorites]);
  return favorites.has(eventId);
}

function isFavorite(eventId) {
  return getFavorites().includes(eventId);
}

function shareEvent(event) {
  const shareData = {
    title: event.title,
    text: `${event.title} on Tucks`,
    url: `${window.location.origin}/events.html?event=${encodeURIComponent(event.id)}`
  };
  if (navigator.share) {
    return navigator.share(shareData);
  }
  return navigator.clipboard.writeText(shareData.url);
}

export {
  apiFetch,
  auth,
  buildCountdownLabel,
  db,
  firstMedia,
  formatDateTime,
  isFavorite,
  money,
  onAuthStateChanged,
  resolveMediaMarkup,
  shareEvent,
  safeArray,
  toggleFavorite
};
