const crypto = require("crypto");
const { db, admin } = require("./firebaseAdmin");
const { requireAuth } = require("./eventAuth");
const { decryptPass } = require("./qrToken");

function serializeEvent(data, id) {
  return {
    id,
    ...data,
    startsAt: data.startsAt?.toDate ? data.startsAt.toDate().toISOString() : data.startsAt || null,
    endsAt: data.endsAt?.toDate ? data.endsAt.toDate().toISOString() : data.endsAt || null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || null
  };
}

function serializeRegistration(data, id) {
  return {
    id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || null
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireAuth(event);
    const { qrToken, eventId } = JSON.parse(event.body || "{}");

    if (!qrToken || !eventId) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing qrToken or eventId" }) };
    }

    const eventKey = String(eventId).trim();
    const eventRef = db.collection("events").doc(eventKey);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ status: "failed", message: "Event not found" }) };
    }

    const eventData = eventDoc.data();
    if (String(eventData.hostUid || "") !== String(user.uid)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ status: "failed", message: "You are not allowed to verify this event" })
      };
    }

    const decoded = decryptPass(qrToken);
    const now = Date.now();
    const maxClockSkewMs = 5 * 60 * 1000;

    if (!decoded?.uid || decoded.scope !== "event-pass") {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Invalid QR token" }) };
    }
    if (typeof decoded.issuedAt !== "number" || Number.isNaN(decoded.issuedAt)) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "QR token is missing issue metadata" }) };
    }
    if (typeof decoded.expiresAt !== "number" || Number.isNaN(decoded.expiresAt)) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "QR token is missing expiry metadata" }) };
    }
    if (decoded.issuedAt - maxClockSkewMs > now) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "QR token is not yet valid" }) };
    }
    if (now > decoded.expiresAt) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "QR token has expired" }) };
    }

    const registrationSnapshot = await db
      .collection("eventRegistrations")
      .where("userId", "==", String(decoded.uid))
      .limit(50)
      .get();

    const matchedRegistrationDoc = registrationSnapshot.docs.find((doc) => String(doc.data()?.eventId || "") === eventKey);

    if (!matchedRegistrationDoc) {
      return {
        statusCode: 403,
        body: JSON.stringify({ status: "failed", approved: false, message: "User is not registered for this event" })
      };
    }

    const registration = matchedRegistrationDoc.data();
    const registrationId = matchedRegistrationDoc.id;
    const checkInId = crypto.createHash("sha256").update(`${eventKey}:${String(decoded.uid)}`).digest("hex");
    const checkInRef = db.collection("eventCheckIns").doc(checkInId);
    const tokenHash = crypto.createHash("sha256").update(String(qrToken)).digest("hex");
    const attendeeSummary = {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.displayName || null,
      issuedAt: decoded.issuedAt,
      expiresAt: decoded.expiresAt,
      scope: decoded.scope,
      tokenId: decoded.tokenId || null
    };

    const alreadyCheckedIn = await db.runTransaction(async (tx) => {
      const [checkInSnap] = await Promise.all([tx.get(checkInRef)]);
      if (checkInSnap.exists) {
        return true;
      }

      tx.create(checkInRef, {
        eventId: eventKey,
        eventTitle: eventData.title || "Untitled event",
        registrationId,
        registrationRef: matchedRegistrationDoc.ref.path,
        attendeeUid: decoded.uid,
        attendeeEmail: decoded.email || null,
        attendeeDisplayName: decoded.displayName || null,
        tokenHash,
        tokenId: decoded.tokenId || null,
        checkedInBy: user.uid,
        checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "checked-in"
      });

      return false;
    });

    if (alreadyCheckedIn) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          status: "failed",
          approved: false,
          message: "This QR has already been used for this event"
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        approved: true,
        event: serializeEvent(eventData, eventDoc.id),
        registration: {
          ...serializeRegistration(registration, registrationId),
          qrToken: undefined
        },
        attendee: attendeeSummary
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ status: "failed", message: error.message }) };
  }
};
