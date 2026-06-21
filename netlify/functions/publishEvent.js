const { db, admin } = require("./firebaseAdmin");
const { verifyPaystackReference, parseJsonBody } = require("./paystackHelpers");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { reference, amount, email, eventData } = parseJsonBody(event);
    if (!reference) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing payment reference" }) };
    }
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Invalid amount" }) };
    }
    if (!email || !eventData) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing email or event details" }) };
    }

    const verified = await verifyPaystackReference(reference);
    if (verified.amount !== Number(amount)) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Payment amount mismatch" }) };
    }

    if (String(verified.customer?.email || "").toLowerCase() !== String(email).toLowerCase()) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Payment email mismatch" }) };
    }

    const startsAt = eventData.date && eventData.time ? new Date(`${eventData.date}T${eventData.time}:00Z`) : null;
    const capacity = Number(eventData.capacity) || null;
    const ticketPrice = Number(eventData.ticketPrice) || 0;

    const eventPayload = {
      title: String(eventData.title || "Untitled event").trim(),
      description: String(eventData.description || "").trim(),
      category: String(eventData.category || "General").trim(),
      organizerName: String(eventData.organizerName || "").trim(),
      organizerEmail: String(email).trim().toLowerCase(),
      location: String(eventData.location || "Online / TBD").trim(),
      ticketPrice,
      capacity,
      startsAt: startsAt ? admin.firestore.Timestamp.fromDate(startsAt) : admin.firestore.FieldValue.serverTimestamp(),
      imageUrl: String(eventData.imageUrl || "").trim(),
      status: "published",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      uploadFee: Number(amount),
      paystackReference: String(reference),
      sold: 0
    };

    const docRef = await db.collection("events").add(eventPayload);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", eventId: docRef.id })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};