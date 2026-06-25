const crypto = require("crypto");
const { requireAuth } = require("./eventAuth");
const { encryptPass } = require("./qrToken");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireAuth(event);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 1000 * 60 * 60 * 12;
    const tokenId = crypto.randomUUID();
    const payload = {
      uid: user.uid,
      email: String(user.email || "").toLowerCase(),
      displayName: String(user.name || user.displayName || "").trim(),
      issuedAt,
      expiresAt,
      scope: "event-pass",
      tokenId
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        qrToken: encryptPass(payload),
        user: {
          uid: user.uid,
          email: payload.email,
          displayName: payload.displayName,
          issuedAt,
          expiresAt,
          tokenId
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};
