const { db, admin } = require("./firebaseAdmin");
const { verifyPaystackReference, parseJsonBody } = require("./paystackHelpers");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { reference, amount, email, buyerName, eventId } = parseJsonBody(event);

    if (!reference || !eventId || !email) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing required ticket purchase fields" }) };
    }

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Invalid amount" }) };
    }

    const verified = await verifyPaystackReference(reference);
    if (verified.amount !== Number(amount)) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Payment amount mismatch" }) };
    }

    if (String(verified.customer?.email || "").toLowerCase() !== String(email).toLowerCase()) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Payment email mismatch" }) };
    }

    const eventRef = db.collection("events").doc(eventId);
    const ticketRef = db.collection("eventTickets").doc();

    await db.runTransaction(async (tx) => {
      const eventSnapshot = await tx.get(eventRef);
      if (!eventSnapshot.exists) {
        throw new Error("Event not found");
      }

      const eventData = eventSnapshot.data();
      const sold = Number(eventData?.sold || 0);
      const capacity = eventData?.capacity || null;

      if (capacity && sold >= capacity) {
        throw new Error("Tickets are sold out");
      }

      const ticketPayload = {
        eventId,
        eventTitle: eventData.title || "Untitled event",
        buyerName: String(buyerName || "Guest").trim(),
        buyerEmail: String(email).trim().toLowerCase(),
        amountPaid: Number(amount),
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paystackReference: String(reference),
        ticketId: ticketRef.id
      };

      await tx.set(ticketRef, ticketPayload);
      await tx.update(eventRef, { sold: sold + 1 });
    });

    const qrPayload = JSON.stringify({ ticketId: ticketRef.id, eventId, buyerEmail: email });

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", ticketId: ticketRef.id, qrValue: qrPayload })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};