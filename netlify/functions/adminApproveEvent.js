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
    if (!eventId) return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Missing eventId' }) };

    const ref = db.collection('events').doc(eventId);
    const snap = await ref.get();
    const current = snap.data() || {};

    if (current.status === 'rejected') {
      return { statusCode: 409, body: JSON.stringify({ status: 'failed', message: 'This event has already been rejected' }) };
    }

    await ref.update({
      status: 'published',
      approvedBy: user.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      pendingExpiresAt: null,
      reviewRequired: false,
      adminReviewNote: String(body.reason || '').trim() || 'Approved after review'
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'success' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: 'failed', message: err.message }) };
  }
};
