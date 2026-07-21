const crypto = require("crypto");
const { db } = require("./firebaseAdmin");
const { authErrorResponse, requireDeliveryAgent } = require("./deliveryAuth");
const { validateDeliveryToken } = require("./deliveryPass");

const OPEN_STATUSES = new Set(["pending", "paid", "processing", "shipped", "out_for_delivery", "out-for-delivery"]);

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatus(status) {
  return String(status || "pending").trim().toLowerCase();
}

function isOpenOrder(order) {
  const status = normalizeStatus(order.status);
  if (status === "delivered" || status === "completed" || status === "cancelled" || status === "canceled" || status === "refunded") {
    return false;
  }
  if (OPEN_STATUSES.has(status)) return true;
  if (Array.isArray(order.items) && order.items.some((item) => normalizeStatus(item.status) !== "delivered")) {
    return true;
  }
  return status === "pending" || status === "paid";
}

function summarizeOrder(docSnap) {
  const data = docSnap.data() || {};
  const deliveryCustomer = data.deliveryCustomer || data.payer || {};
  const items = Array.isArray(data.items)
    ? data.items.map((item) => ({
        id: item.id || null,
        name: item.name || "Item",
        qty: Number(item.qty || 1),
        size: item.size || null,
        color: item.color || null,
        status: normalizeStatus(item.status || data.status)
      }))
    : [];

  return {
    docId: docSnap.id,
    orderId: data.orderId || docSnap.id,
    status: normalizeStatus(data.status),
    total: Number(data.total || 0),
    shippingMethod: data.shippingMethod || null,
    note: data.note || "",
    createdAt: serializeTimestamp(data.createdAt),
    deliveryCustomer: {
      name: deliveryCustomer.name || data.payer?.name || null,
      phone: deliveryCustomer.phone || data.payer?.phone || null,
      email: deliveryCustomer.email || data.payer?.email || null,
      address: deliveryCustomer.address || data.payer?.address || null
    },
    payer: data.payer
      ? {
          name: data.payer.name || null,
          phone: data.payer.phone || null,
          email: data.payer.email || null
        }
      : null,
    items,
    itemCount: items.reduce((sum, item) => sum + Number(item.qty || 1), 0)
  };
}

async function findCustomerOrders(uid, email) {
  const byId = new Map();
  const queries = [
    db.collection("orders").where("userId", "==", uid).limit(25),
    db.collection("orders").where("payerUid", "==", uid).limit(25)
  ];

  if (email) {
    queries.push(db.collection("orders").where("payerEmail", "==", email).limit(25));
  }

  const snapshots = await Promise.all(
    queries.map(async (query) => {
      try {
        return await query.get();
      } catch (error) {
        console.warn("Order query failed", error.message);
        return { docs: [] };
      }
    })
  );

  snapshots.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      byId.set(docSnap.id, docSnap);
    });
  });

  return [...byId.values()]
    .map(summarizeOrder)
    .filter((order) => isOpenOrder(order))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const agent = await requireDeliveryAgent(event);
    const body = JSON.parse(event.body || "{}");
    const qrToken = String(body.qrToken || "").trim();

    if (!qrToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Missing qrToken" })
      };
    }

    const decoded = validateDeliveryToken(qrToken);
    const orders = await findCustomerOrders(decoded.uid, decoded.email);
    const tokenHash = crypto.createHash("sha256").update(qrToken).digest("hex");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        verified: true,
        scannedAt: new Date().toISOString(),
        scannedBy: {
          uid: agent.uid,
          email: agent.email || null
        },
        customer: {
          uid: decoded.uid,
          email: decoded.email || null,
          displayName: decoded.displayName || null,
          memberId: String(decoded.uid).slice(-8).toUpperCase(),
          tokenId: decoded.tokenId || null,
          expiresAt: decoded.expiresAt
        },
        orders,
        tokenHash,
        message: orders.length
          ? `Found ${orders.length} open delivery order${orders.length === 1 ? "" : "s"}.`
          : "Customer verified, but no open delivery orders were found."
      })
    };
  } catch (error) {
    return authErrorResponse(error);
  }
};
