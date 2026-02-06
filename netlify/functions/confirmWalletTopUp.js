import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

export async function handler(event) {
  try {
    const { topUpId } = JSON.parse(event.body);
    if (!topUpId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing topUpId' }) };

    const topUpRef = doc(db, 'walletTopUps', topUpId);
    const topUpSnap = await getDoc(topUpRef);
    if (!topUpSnap.exists()) return { statusCode: 404, body: JSON.stringify({ error: 'Top-up not found' }) };

    const data = topUpSnap.data();

    // mark as "awaiting verification"
    await updateDoc(topUpRef, { status: 'awaiting_verification' });

    // optionally: temporarily credit wallet
    const userRef = doc(db, 'users', data.uid);
    await updateDoc(userRef, {
      walletBalance: (data.amount || 0) + (userRef.walletBalance || 0)
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Top-up confirmed. Admin will verify.' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}