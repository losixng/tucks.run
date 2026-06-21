const { db } = require("./firebaseAdmin");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const eventsSnapshot = await db
      .collection("events")
      .where("status", "==", "published")
      .orderBy("startsAt", "asc")
      .limit(100)
      .get();

    const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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