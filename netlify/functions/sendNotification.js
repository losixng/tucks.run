const admin = require('firebase-admin');

// Initialize Firebase Admin SDK once
function initFirebase() {
  if (admin.apps && admin.apps.length) return;
  // Prefer Application Default Credentials, fallback to FIREBASE_SERVICE_ACCOUNT env
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp();
  }
}

exports.handler = async function (event) {
  try {
    initFirebase();
    const body = event.body ? JSON.parse(event.body) : {};
    const { target = 'all', title = 'Tucks', message = '', data = {} } = body;

    const messaging = admin.messaging();

    // If target is 'all', send to a topic 'all'
    if (target === 'all') {
      const payload = {
        notification: { title, body: message },
        data: typeof data === 'object' ? data : { data: String(data) }
      };
      await messaging.sendToTopic('all', payload);
      return { statusCode: 200, body: JSON.stringify({ ok: true, sentTo: 'topic:all' }) };
    }

    // Otherwise treat target as an email and collect tokens
    const db = admin.firestore();

    // 1) lookup users collection for fcmToken(s)
    const tokens = [];
    try {
      const usersRef = db.collection('users');
      const q = await usersRef.where('email', '==', String(target).toLowerCase()).get();
      q.forEach(doc => {
        const dataDoc = doc.data();
        if (Array.isArray(dataDoc.fcmTokens)) tokens.push(...dataDoc.fcmTokens);
        if (dataDoc.fcmToken) tokens.push(dataDoc.fcmToken);
      });
    } catch (e) {
      console.warn('users lookup failed', e.message);
    }

    // 2) also lookup a fallback collection 'fcm_tokens' where client may store tokens
    try {
      const tRef = db.collection('fcm_tokens');
      const tq = await tRef.where('email', '==', String(target).toLowerCase()).get();
      tq.forEach(doc => {
        const d = doc.data();
        if (d && d.token) tokens.push(d.token);
      });
    } catch (e) {
      console.warn('fcm_tokens lookup failed', e.message);
    }

    if (!tokens.length) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'no_tokens_found' }) };
    }

    const payload = {
      notification: { title, body: message },
      data: typeof data === 'object' ? data : { data: String(data) }
    };

    const resp = await messaging.sendToDevice(tokens.filter(Boolean), payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true, result: resp }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
