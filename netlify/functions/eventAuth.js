const { admin } = require("./firebaseAdmin");

function getHeaderValue(headers, name) {
  if (!headers) return "";
  const target = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value || "";
    }
  }
  return "";
}

function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
}

function getBearerToken(event) {
  const authHeader = getHeaderValue(event.headers, "authorization");
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function requireAuth(event) {
  const token = getBearerToken(event);
  if (!token) {
    throw new Error("No authorization token provided");
  }
  return admin.auth().verifyIdToken(token);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

module.exports = {
  getBearerToken,
  normalizeEmail,
  normalizeList,
  normalizeText,
  parseJsonBody,
  requireAuth
};
