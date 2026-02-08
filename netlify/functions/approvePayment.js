const { db, admin } = require("./firebaseAdmin");

exports.handler = async (event) => {
  try {
    const { intentId } = JSON.parse(event.body);

    const intentRef = db.collection("walletTransactions").doc(intentId);

    await db.runTransaction(async (t) => {
      const intentDoc = await t.get(intentRef);
      if (!intentDoc.exists) throw new Error("Intent not found");

      const data = intentDoc.data();
      if (data.status !== "pending")
        throw new Error("Already processed");

      const walletRef = db.collection("wallets").doc(data.userId);
      const walletDoc = await t.get(walletRef);

      const currentBalance = walletDoc.exists
        ? walletDoc.data().balance
        : 0;

      const newBalance = currentBalance + data.amount;

      t.set(walletRef, {
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      t.update(intentRef, {
        status: "matched",
        matchedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const transactionRef = db.collection("wallet_transactions").doc();

      t.set(transactionRef, {
        userId: data.userId,
        amount: data.amount,
        type: "credit",
        reference: data.couponCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { statusCode: 200, body: "Wallet credited" };
  } catch (err) {
    return { statusCode: 400, body: err.message };
  }
};