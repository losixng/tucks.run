const { decryptPass } = require("./qrToken");

function validateDeliveryToken(qrToken) {
  let decoded;
  try {
    decoded = decryptPass(qrToken);
  } catch (error) {
    throw Object.assign(new Error("Invalid delivery QR token"), { statusCode: 400 });
  }

  const now = Date.now();
  const maxClockSkewMs = 5 * 60 * 1000;

  if (!decoded?.uid || decoded.scope !== "delivery-pass") {
    throw Object.assign(new Error("Invalid delivery QR token"), { statusCode: 400 });
  }
  if (typeof decoded.issuedAt !== "number" || Number.isNaN(decoded.issuedAt)) {
    throw Object.assign(new Error("QR token is missing issue metadata"), { statusCode: 400 });
  }
  if (typeof decoded.expiresAt !== "number" || Number.isNaN(decoded.expiresAt)) {
    throw Object.assign(new Error("QR token is missing expiry metadata"), { statusCode: 400 });
  }
  if (decoded.issuedAt - maxClockSkewMs > now) {
    throw Object.assign(new Error("QR token is not yet valid"), { statusCode: 400 });
  }
  if (now > decoded.expiresAt) {
    throw Object.assign(
      new Error("QR token has expired. Ask the customer to refresh their TUCKS ID card."),
      { statusCode: 400 }
    );
  }

  return decoded;
}

module.exports = { validateDeliveryToken };
