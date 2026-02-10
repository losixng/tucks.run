const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  try {
    const { userId, amount, description } = JSON.parse(event.body);

    if (!userId || !amount) {
      return { statusCode: 400, body: JSON.stringify({ success: false }) };
    }

    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) throw new Error("User not found");

      const currentBalance = userDoc.data().balance || 0;

      if (currentBalance < amount) throw new Error("Insufficient");

      transaction.update(userRef, {
        balance: currentBalance - amount
      });

      transaction.set(db.collection("walletTransactions").doc(), {
        userId,
        amount,
        type: "debit",
        status: "approved",
        description: description || "Wallet payment",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false })
    };
  }
};