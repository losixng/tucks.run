const { db, admin } = require("./firebaseAdmin");
const verifyUser = require("./verifyToken");

exports.handler = async (event) => {
  try {
    const user = await verifyUser(event);
    const { amount, senderName } = JSON.parse(event.body);

    if (!amount || !senderName)
      return { statusCode: 400, body: "Missing fields" };

    const coupon =
      "LOSIX-" +
      Math.random().toString(36).substring(2, 8).toUpperCase();

    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 15 * 60 * 1000)
    );

    await db.collection("payment_intents").add({
      userId: user.uid,
      amount: Number(amount),
      senderName,
      couponCode: coupon,
      status: "pending",
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ coupon })
    };
  } catch (err) {
    return { statusCode: 401, body: err.message };
  }
};