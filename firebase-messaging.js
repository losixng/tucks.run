// Lightweight client that registers for FCM and stores tokens in Firestore.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCQxHHt5vbL6TEThEhiE5LrK9afBh_GIIA',
  authDomain: 'tucksmarket.firebaseapp.com',
  projectId: 'tucksmarket',
  storageBucket: 'tucksmarket.firebasestorage.app',
  messagingSenderId: '1001257918215',
  appId: '1:1001257918215:web:dee38052091d481073efa2',
  measurementId: 'G-3QE87BNYRJ'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

function getVapidKey() {
  return window.__TUCKS_VAPID_KEY || window.__TUCKS_PUSH_VAPID_KEY || null;
}

async function ensurePermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  return Notification.requestPermission();
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.ready;
}

export async function registerForPush(userEmail = '') {
  try {
    const permission = await ensurePermission();
    if (permission !== 'granted') {
      return null;
    }

    const registration = await getServiceWorkerRegistration();
    const vapidKey = getVapidKey();
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      const id = token.slice(0, 20);
      const docRef = doc(db, 'fcm_tokens', id);
      await setDoc(
        docRef,
        {
          token,
          email: (userEmail || '').toLowerCase(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    return token;
  } catch (err) {
    console.warn('Token registration failed', err.message || err);
    return null;
  }
}

export async function initializePushNotifications(userEmail = '') {
  try {
    const permission = await ensurePermission();
    if (permission !== 'granted') {
      return { permission, token: null };
    }

    const token = await registerForPush(userEmail);
    return { permission, token };
  } catch (err) {
    console.warn('Push initialization failed', err.message || err);
    return { permission: 'error', token: null };
  }
}

export function onForegroundMessage(cb) {
  onMessage(messaging, (payload) => {
    try {
      cb(payload);
    } catch (e) {
      console.warn(e);
    }
  });
}
