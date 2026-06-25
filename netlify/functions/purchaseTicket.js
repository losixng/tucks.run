const { db, admin } = require("./firebaseAdmin");
const { verifyPaystackReference, parseJsonBody } = require("./paystackHelpers");
const { requireAuth, normalizeEmail, normalizeText } = require("./eventAuth");
const { calculateAttendeeCharge, toKobo, toNumber } = require("./eventPricing");
const { encryptPass } = require("./qrToken");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireAuth(event);
    const { reference, email, buyerName, eventId, quantity, tierId, answers } = parseJsonBody(event);

    if (!reference || !eventId || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Missing required ticket purchase fields" })
      };
    }

    if (normalizeEmail(user.email || email) !== normalizeEmail(email)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ status: "failed", message: "Ticket purchase email must match the signed-in account" })
      };
    }

    const eventRef = db.collection("events").doc(String(eventId).trim());
    const eventSnapshot = await eventRef.get();
    if (!eventSnapshot.exists) {
      return { statusCode: 404, body: JSON.stringify({ status: "failed", message: "Event not found" }) };
    }

    const eventData = eventSnapshot.data();
    if (eventData.status !== "published") {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Event is not available" }) };
    }

    const minTicketsPerOrder = Math.max(1, Math.floor(toNumber(eventData.minTicketsPerOrder, 1)));
    const maxTicketsPerOrder = Math.max(1, Math.floor(toNumber(eventData.maxTicketsPerOrder, 10)));
    const requestedQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));

    if (requestedQuantity < minTicketsPerOrder || requestedQuantity > maxTicketsPerOrder) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "failed",
          message: `Quantity must be between ${minTicketsPerOrder} and ${maxTicketsPerOrder}`
        })
      };
    }

    const tiers = Array.isArray(eventData.tiers) ? eventData.tiers : [];
    const selectedTier = tierId ? tiers.find((tier) => String(tier.id) === String(tierId)) : null;
    if (selectedTier?.quantityLimit && requestedQuantity > Number(selectedTier.quantityLimit)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "failed",
          message: `Selected tier allows a maximum of ${selectedTier.quantityLimit} ticket(s)`
        })
      };
    }

    const ticketPrice = selectedTier ? toNumber(selectedTier.price, 0) : toNumber(eventData.ticketPrice, 0);
    const computedCharge = calculateAttendeeCharge(ticketPrice, requestedQuantity);
    const attendeeFields = Array.isArray(eventData.attendeeFields) ? eventData.attendeeFields : [];
    const normalizedAnswers = Array.isArray(answers) ? answers : [];
    const answerLookup = new Map();
    let validationError = "";

    normalizedAnswers.forEach((answer) => {
      if (answer && typeof answer === "object") {
        const key = String(answer.fieldId || answer.id || answer.label || "").trim();
        if (key) {
          answerLookup.set(key, answer.value ?? answer.answer ?? answer.text ?? "");
        }
      }
    });

    attendeeFields.forEach((field) => {
      const fieldKey = String(field.id || field.label || "").trim();
      if (!fieldKey) return;
      const providedValue = answerLookup.get(fieldKey);
      if (field.required && (providedValue === undefined || providedValue === null || String(providedValue).trim() === "")) {
        validationError = `Missing required attendee field: ${field.label}`;
      }
    });

    if (validationError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: validationError })
      };
    }

    const verified = await verifyPaystackReference(reference);
    if (Number(verified.amount) !== toKobo(computedCharge.total)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Payment amount mismatch" })
      };
    }

    if (String(verified.customer?.email || "").toLowerCase() !== normalizeEmail(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Payment email mismatch" })
      };
    }

    const approvedQuantity = computedCharge.quantity;
    const ticketRef = db.collection("eventTickets").doc();
    const attendeeRef = db.collection("eventRegistrations").doc();
    const qrToken = encryptPass({
      uid: user.uid,
      email: normalizeEmail(user.email || email),
      displayName: normalizeText(user.name || buyerName || verified.customer?.name || ""),
      issuedAt: Date.now(),
      scope: "event-pass"
    });

    await db.runTransaction(async (tx) => {
      const freshEventSnapshot = await tx.get(eventRef);
      if (!freshEventSnapshot.exists) {
        throw new Error("Event not found");
      }

      const freshEventData = freshEventSnapshot.data();
      const sold = Number(freshEventData?.sold || 0);
      const capacity = freshEventData?.capacity || null;

      if (capacity && sold + approvedQuantity > capacity) {
        throw new Error("Tickets are sold out");
      }

      const ticketPayload = {
        userId: user.uid,
        eventId,
        eventTitle: freshEventData.title || "Untitled event",
        buyerName: normalizeText(buyerName || user.name || verified.customer?.name || "Guest"),
        buyerEmail: normalizeEmail(email),
        ticketTierId: selectedTier ? selectedTier.id : null,
        ticketTierName: selectedTier ? selectedTier.name : null,
        quantity: approvedQuantity,
        amountPaid: Number(computedCharge.total),
        baseTicketAmount: Number(computedCharge.ticketSubtotal),
        registrationFee: Number(computedCharge.registrationFee),
        gatewayFee: Number(computedCharge.gatewayFee),
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paystackReference: String(reference),
        ticketId: ticketRef.id,
        answers: normalizedAnswers,
        qrToken
      };

      await tx.set(ticketRef, ticketPayload);
      await tx.set(attendeeRef, {
        userId: user.uid,
        eventId,
        ticketId: ticketRef.id,
        eventTitle: freshEventData.title || "Untitled event",
        ticketTierId: selectedTier ? selectedTier.id : null,
        ticketTierName: selectedTier ? selectedTier.name : null,
        quantity: approvedQuantity,
        amountPaid: Number(computedCharge.total),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "registered",
        qrToken,
        answers: normalizedAnswers
      });

      tx.update(eventRef, {
        sold: sold + approvedQuantity,
        attendees: Number(freshEventData.attendees || 0) + approvedQuantity
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        ticketId: ticketRef.id,
        attendeeId: attendeeRef.id,
        qrToken,
        amountPaid: Number(computedCharge.total)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};
