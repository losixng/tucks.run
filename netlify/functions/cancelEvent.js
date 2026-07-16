const { db, admin } = require("./firebaseAdmin");
const { requireAuth } = require("./eventAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = await requireAuth(event);
    const body = JSON.parse(event.body || '{}');
    const eventId = String(body.eventId || '').trim();
    if (!eventId) return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Missing eventId' }) };

    const ref = db.collection('events').doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) return { statusCode: 404, body: JSON.stringify({ status: 'failed', message: 'Event not found' }) };
    const data = snap.data();
    if (data.hostUid !== user.uid) return { statusCode: 403, body: JSON.stringify({ status: 'failed', message: 'Forbidden' }) };

    // Only allow cancel during pending window
    const now = Date.now();
    const pendingUntil = data.pendingExpiresAt?.toDate ? data.pendingExpiresAt.toDate().getTime() : (data.pendingExpiresAt ? new Date(data.pendingExpiresAt).getTime() : 0);
    if (!data.status || data.status !== 'pending' || pendingUntil < now) {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Event cannot be cancelled at this stage' }) };
    }

    await ref.update({
      status: 'cancelled',
      cancelledByHost: true,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      refundRequested: true
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'success' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: 'failed', message: err.message }) };
  }
};
