const { db } = require("./firebaseAdmin");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const ticketId = String((event.queryStringParameters || {}).ticketId || "").trim();
  if (!ticketId) {
    return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing ticketId" }) };
  }

  try {
    const ticketDoc = await db.collection("eventTickets").doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ status: "failed", message: "Ticket not found" }) };
    }

    const ticket = ticketDoc.data();
    const eventDoc = await db.collection("events").doc(ticket.eventId).get();
    const eventData = eventDoc.exists ? eventDoc.data() : null;

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", ticket: { ...ticket, ticketId }, event: eventData })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ status: "failed", message: error.message }) };
  }
};