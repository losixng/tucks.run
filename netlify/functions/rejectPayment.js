const { db, admin } = require("./firebaseAdmin");

exports.handler = async (event) => {
  const { intentId } = JSON.parse(event.body);

  await db.collection("walletTransactions").doc(intentId).update({
    status: "rejected",
    rejectedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { statusCode: 200, body: "Rejected" };
};