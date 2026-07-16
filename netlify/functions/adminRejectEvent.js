const { db, admin } = require("./firebaseAdmin");
const { requireAuth } = require("./eventAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = await requireAuth(event);
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    if (adminEmail && String(user.email || '').toLowerCase() !== adminEmail) {
      return { statusCode: 403, body: JSON.stringify({ status: 'failed', message: 'Forbidden' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const eventId = String(body.eventId || '').trim();
    const reason = String(body.reason || '').trim();
    if (!eventId) return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Missing eventId' }) };

    const ref = db.collection('events').doc(eventId);
    await ref.update({
      status: 'rejected',
      rejectedBy: user.uid,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason || 'Not approved'
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'success' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: 'failed', message: err.message }) };
  }
};
