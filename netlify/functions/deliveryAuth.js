const { db } = require("./firebaseAdmin");
const { requireAuth, normalizeEmail } = require("./eventAuth");

/** Firebase accounts whose email contains this marker may use the delivery scanner. */
const DELIVERY_EMAIL_MARKER = "delivery.losix";

function parseEmailList(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

function isDeliveryLosixAccount(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && normalized.includes(DELIVERY_EMAIL_MARKER);
}

async function isDeliveryAgent(user) {
  const email = normalizeEmail(user?.email);
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const deliveryEmails = parseEmailList(process.env.DELIVERY_EMAILS);

  // Primary rule: any signed-in Firebase account with "delivery.losix" in the email.
  if (isDeliveryLosixAccount(email)) return true;

  if (adminEmail && email === adminEmail) return true;
  if (email && deliveryEmails.includes(email)) return true;

  try {
    const snap = await db.collection("users").doc(String(user.uid)).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const role = String(data.role || "").trim().toLowerCase();
    return (
      data.isDeliveryAgent === true ||
      role === "delivery" ||
      role === "delivery_agent" ||
      role === "courier" ||
      role === "admin"
    );
  } catch (error) {
    console.warn("Delivery role lookup failed", error.message);
    return false;
  }
}

async function requireDeliveryAgent(event) {
  const user = await requireAuth(event);
  const allowed = await isDeliveryAgent(user);
  if (!allowed) {
    const err = new Error("Only authorized delivery agents can use this scanner");
    err.statusCode = 403;
    throw err;
  }
  return user;
}

function authErrorResponse(error) {
  const message = error?.message || "Request failed";
  let statusCode = error?.statusCode;
  if (!statusCode) {
    if (/authorization|sign in|no authorization/i.test(message)) statusCode = 401;
    else if (/forbidden|not authorized|delivery agent/i.test(message)) statusCode = 403;
    else if (/invalid|missing|expired|not yet valid/i.test(message)) statusCode = 400;
    else statusCode = 500;
  }
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "failed",
      message
    })
  };
}

module.exports = {
  authErrorResponse,
  DELIVERY_EMAIL_MARKER,
  isDeliveryAgent,
  isDeliveryLosixAccount,
  parseEmailList,
  requireDeliveryAgent
};
