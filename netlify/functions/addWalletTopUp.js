import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const { uid, amount } = body;

    if (!uid || !amount || amount <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid request" }) };
    }

    // generate narration code
    const narrationCode = 'WTX-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // expiry: 15 mins from now
    const expiryTimestamp = Date.now() + 15 * 60 * 1000;

    const docRef = await addDoc(collection(db, 'walletTopUps'), {
      uid,
      amount,
      narrationCode,
      expiryTimestamp,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ topUpId: docRef.id, narrationCode, expiryTimestamp })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}