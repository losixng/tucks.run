const { db } = require("./firebaseAdmin");
const { requireAuth } = require("./eventAuth");

function serializeEvent(data, id) {
  return {
    id,
    ...data,
    startsAt: data.startsAt?.toDate ? data.startsAt.toDate().toISOString() : data.startsAt || null,
    endsAt: data.endsAt?.toDate ? data.endsAt.toDate().toISOString() : data.endsAt || null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || null,
    pendingExpiresAt: data.pendingExpiresAt?.toDate ? data.pendingExpiresAt.toDate().toISOString() : data.pendingExpiresAt || null
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method not allowed" };
  try {
    const user = await requireAuth(event);
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    if (adminEmail && String(user.email || "").toLowerCase() !== adminEmail) {
      return { statusCode: 403, body: JSON.stringify({ status: 'failed', message: 'Forbidden' }) };
    }

    const q = db.collection('events').where('status', 'in', ['pending', 'cancellation_requested']);
    const snap = await q.limit(200).get();
    const events = snap.docs.map(d => serializeEvent(d.data(), d.id));
    return { statusCode: 200, body: JSON.stringify({ status: 'success', events }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: 'failed', message: err.message }) };
  }
};
