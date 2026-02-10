const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const { transactionId } = JSON.parse(event.body);

  const txnRef = db.collection("walletTransactions").doc(transactionId);
  const txnDoc = await txnRef.get();

  if (!txnDoc.exists) {
    return { statusCode: 404 };
  }

  const { userId, amount } = txnDoc.data();
  const userRef = db.collection("users").doc(userId);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const currentBalance = userDoc.data().balance || 0;

    transaction.update(userRef, {
      balance: currentBalance + amount
    });

    transaction.update(txnRef, {
      status: "approved"
    });
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};