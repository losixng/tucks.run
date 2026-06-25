const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountRaw) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountRaw))
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
      })
    });
  }
}

const db = admin.firestore();

module.exports = { admin, db };
