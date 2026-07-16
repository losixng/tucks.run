const { db } = require("./firebaseAdmin");
const { requireAuth } = require("./eventAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
    const user = await requireAuth(event);
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    if (adminEmail && String(user.email || '').toLowerCase() !== adminEmail) {
      return { statusCode: 403, body: JSON.stringify({ status: 'failed', message: 'Forbidden' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const eventId = String(body.eventId || '').trim();
    if (!eventId) return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Missing eventId' }) };
    await db.collection('events').doc(eventId).delete();
    return { statusCode: 200, body: JSON.stringify({ status: 'success' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: 'failed', message: err.message }) };
  }
};
