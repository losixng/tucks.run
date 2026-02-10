const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const { userId } = JSON.parse(event.body);

  const doc = await db.collection("users").doc(userId).get();

  return {
    statusCode: 200,
    body: JSON.stringify({
      balance: doc.exists ? doc.data().balance || 0 : 0
    })
  };
};