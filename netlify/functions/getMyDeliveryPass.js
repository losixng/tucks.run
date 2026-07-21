const crypto = require("crypto");
const { requireAuth } = require("./eventAuth");
const { encryptPass } = require("./qrToken");

const PASS_TTL_MS = 1000 * 60 * 30;

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireAuth(event);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + PASS_TTL_MS;
    const tokenId = crypto.randomUUID();
    const displayName = String(user.name || user.displayName || "").trim();
    const email = String(user.email || "").toLowerCase();

    const payload = {
      uid: user.uid,
      email,
      displayName,
      issuedAt,
      expiresAt,
      scope: "delivery-pass",
      tokenId
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        qrToken: encryptPass(payload),
        user: {
          uid: user.uid,
          email,
          displayName,
          issuedAt,
          expiresAt,
          tokenId,
          memberId: String(user.uid).slice(-8).toUpperCase()
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};
