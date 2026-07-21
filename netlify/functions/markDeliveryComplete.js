const crypto = require("crypto");
const { db, admin } = require("./firebaseAdmin");
const { authErrorResponse, requireDeliveryAgent } = require("./deliveryAuth");
const { validateDeliveryToken } = require("./deliveryPass");

function normalizeStatus(status) {
  return String(status || "pending").trim().toLowerCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const agent = await requireDeliveryAgent(event);
    const body = JSON.parse(event.body || "{}");
    const qrToken = String(body.qrToken || "").trim();
    const orderDocId = String(body.orderDocId || "").trim();

    if (!qrToken || !orderDocId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Missing qrToken or orderDocId" })
      };
    }

    const decoded = validateDeliveryToken(qrToken);
    const orderRef = db.collection("orders").doc(orderDocId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ status: "failed", message: "Order not found" })
      };
    }

    const order = orderSnap.data() || {};
    const ownerMatches =
      String(order.userId || "") === String(decoded.uid) ||
      String(order.payerUid || "") === String(decoded.uid) ||
      String(order.payerEmail || "").toLowerCase() === String(decoded.email || "").toLowerCase() ||
      String(order.payer?.email || "").toLowerCase() === String(decoded.email || "").toLowerCase() ||
      String(order.deliveryCustomer?.email || "").toLowerCase() === String(decoded.email || "").toLowerCase();

    if (!ownerMatches) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          status: "failed",
          message: "This order does not belong to the scanned customer"
        })
      };
    }

    if (normalizeStatus(order.status) === "delivered") {
      return {
        statusCode: 409,
        body: JSON.stringify({
          status: "failed",
          message: "This order is already marked as delivered"
        })
      };
    }

    const tokenHash = crypto.createHash("sha256").update(qrToken).digest("hex");
    const items = Array.isArray(order.items)
      ? order.items.map((item) => ({ ...item, status: "delivered" }))
      : order.items;

    await orderRef.update({
      items,
      status: "delivered",
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      deliveredBy: {
        uid: agent.uid,
        email: agent.email || null
      },
      deliveryProof: {
        method: "qr_scan",
        tokenHash,
        tokenId: decoded.tokenId || null,
        customerUid: decoded.uid,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        message: "Order marked as delivered",
        order: {
          docId: orderDocId,
          orderId: order.orderId || orderDocId,
          status: "delivered"
        }
      })
    };
  } catch (error) {
    return authErrorResponse(error);
  }
};
