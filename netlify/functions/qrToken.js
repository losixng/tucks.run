const crypto = require("crypto");

function getSecret() {
  const secret =
    process.env.EVENT_QR_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.PAYSTACK_SECRET_KEY ||
    "tucks-events-development-secret";

  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encodeBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function encryptPass(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecret(), iv);
  const encoded = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    "tucksqr",
    encodeBase64Url(iv),
    encodeBase64Url(encoded),
    encodeBase64Url(tag)
  ].join(".");
}

function decryptPass(token) {
  const [prefix, ivPart, payloadPart, tagPart] = String(token || "").split(".");
  if (prefix !== "tucksqr" || !ivPart || !payloadPart || !tagPart) {
    throw new Error("Invalid QR token");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getSecret(), decodeBase64Url(ivPart));
  decipher.setAuthTag(decodeBase64Url(tagPart));

  const decoded = Buffer.concat([
    decipher.update(decodeBase64Url(payloadPart)),
    decipher.final()
  ]).toString("utf8");

  return JSON.parse(decoded);
}

module.exports = { decryptPass, encryptPass };
