const { admin } = require("./firebaseAdmin");

async function verifyUser(event) {
  const token = event.headers.authorization?.split("Bearer ")[1];
  if (!token) throw new Error("No token provided");

  const decoded = await admin.auth().verifyIdToken(token);
  return decoded;
}

module.exports = verifyUser;