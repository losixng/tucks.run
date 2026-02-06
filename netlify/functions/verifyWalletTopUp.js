import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

export async function handler(event) {
  try {
    const { topUpId, action } = JSON.parse(event.body); // action = 'verified' | 'rejected'
    if (!topUpId || !action) return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };

    const topUpRef = doc(db, 'walletTopUps', topUpId);
    const data = (await topUpRef.get()).data();

    if (!data) return { statusCode: 404, body: JSON.stringify({ error: 'Top-up not found' }) };

    await updateDoc(topUpRef, { status: action });

    // adjust wallet balance if rejected
    if (action === 'rejected') {
      const userRef = doc(db, 'users', data.uid);
      await updateDoc(userRef, { walletBalance: (userRef.walletBalance || 0) - data.amount });
    }

    return { statusCode: 200, body: JSON.stringify({ message: `Top-up ${action}` }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}