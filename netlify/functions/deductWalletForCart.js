import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

export async function handler(event) {
  try {
    const { uid, cart, total } = JSON.parse(event.body);

    if (!uid || !cart || !total) return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };

    const balance = userSnap.data().walletBalance || 0;
    if (balance < total) return { statusCode: 400, body: JSON.stringify({ error: 'Insufficient wallet balance' }) };

    await updateDoc(userRef, { walletBalance: balance - total });

    // save order
    await addDoc(collection(db, 'orders'), {
      uid,
      products: cart,
      total,
      paymentMethod: 'wallet',
      status: 'paid',
      createdAt: serverTimestamp()
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Payment successful via wallet' }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}