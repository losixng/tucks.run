Netlify + Firebase Push Notifications Setup

Overview
- A Netlify function `/.netlify/functions/sendNotification` is added. It uses the Firebase Admin SDK to send push messages.
- A client helper `firebase-messaging.js` registers FCM tokens to Firestore collection `fcm_tokens`.
- `service-worker.js` handles incoming `push` events and displays notifications.
- `admin-dashboard.html` now has a small form to send notifications to `all` or a specific user email.

Required environment variables (set in Netlify UI)
- `FIREBASE_SERVICE_ACCOUNT` : JSON string of your service account key for Firebase Admin. Example content: `{"type":"service_account", ...}`. Use `JSON.stringify()` when pasting.

Optional
- If you prefer Application Default Credentials on Netlify, configure service account via Netlify build environment and the Admin SDK will pick it up.

VAPID key
- The web client uses the VAPID key for `getToken()` if you set `window.__TUCKS_VAPID_KEY` before loading `firebase-messaging.js`.
- Generate the VAPID key pair from your Firebase console (Cloud Messaging -> Web Push certificates) and set the public key in your pages, e.g. in `index.html`:

<script>window.__TUCKS_VAPID_KEY = 'YOUR_PUBLIC_VAPID_KEY';</script>

Security and Notes
- The Netlify function requires `FIREBASE_SERVICE_ACCOUNT` to send messages to user tokens and to topic `all`.
- Tokens are saved in Firestore collection `fcm_tokens` by the client; the Netlify function also checks `users` collection for `fcmToken(s)`.
- This setup aims to be low-maintenance but you must supply the service account and VAPID key once.

Deployment
- Push changes to your repo and Netlify will deploy the function automatically. Ensure `netlify.toml` includes the functions folder or default `_redirects` and functions config.

Troubleshooting
- Check function logs in Netlify for errors when calling the endpoint.
- Ensure `firebase-admin` dependency is present in `package.json`.
