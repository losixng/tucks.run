const { db } = require("./firebaseAdmin");
const { requireAuth } = require("./eventAuth");

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
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireAuth(event);

    const hostedSnapshot = await db
      .collection("events")
      .where("hostUid", "==", user.uid)
      .limit(100)
      .get();

    const registrationsSnapshot = await db
      .collection("eventRegistrations")
      .where("userId", "==", user.uid)
      .limit(200)
      .get();

    const hostedEvents = hostedSnapshot.docs
      .map((doc) => serializeEvent(doc.data(), doc.id))
      .sort((a, b) => {
        const aTime = a.startsAt ? new Date(a.startsAt).getTime() : 0;
        const bTime = b.startsAt ? new Date(b.startsAt).getTime() : 0;
        return aTime - bTime;
      });

    const registrations = registrationsSnapshot.docs
      .map((doc) => serializeRegistration(doc.data(), doc.id))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        hostedEvents,
        registrations
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};
