const { db } = require("./firebaseAdmin");

function serializeEvent(data, id) {
  return {
    id,
    ...data,
    startsAt: data.startsAt?.toDate ? data.startsAt.toDate().toISOString() : data.startsAt || null,
    endsAt: data.endsAt?.toDate ? data.endsAt.toDate().toISOString() : data.endsAt || null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || null
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    let query = db.collection("events").where("status", "==", "published");

    if (String((event.queryStringParameters || {}).hostUid || "").trim()) {
      query = query.where("hostUid", "==", String(event.queryStringParameters.hostUid).trim());
    }

    const eventsSnapshot = await query.limit(200).get();
    const events = eventsSnapshot.docs
      .map((doc) => serializeEvent(doc.data(), doc.id))
      .sort((a, b) => {
        const aTime = a.startsAt ? new Date(a.startsAt).getTime() : 0;
        const bTime = b.startsAt ? new Date(b.startsAt).getTime() : 0;
        return aTime - bTime;
      });

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", events })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};
