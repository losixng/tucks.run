const { db, admin } = require("./firebaseAdmin");
const { verifyPaystackReference, parseJsonBody } = require("./paystackHelpers");
const { requireAuth, normalizeEmail, normalizeList, normalizeText } = require("./eventAuth");
const { calculateHostCharge, toKobo, toNumber } = require("./eventPricing");

function parseDateTimeInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireAuth(event);
    const { reference, amount, email, eventData } = parseJsonBody(event);

    if (!reference) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Missing payment reference" })
      };
    }

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Invalid amount" }) };
    }

    if (!email || !eventData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Missing email or event details" })
      };
    }

    if (normalizeEmail(user.email || email) !== normalizeEmail(email)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ status: "failed", message: "Event payment email must match the signed-in account" })
      };
    }

    const expectedHostCharge = calculateHostCharge();
    const verified = await verifyPaystackReference(reference);

    // Validation limits
    const MAX_TIERS = 10;
    const MAX_MEDIA = 10;
    const MAX_ATTENDEE_FIELDS = 20;
    const MAX_TITLE_LEN = 200;
    const MAX_DESC_LEN = 5000;

    if (verified.amount !== Number(amount)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Payment amount mismatch" })
      };
    }

    if (Number(verified.amount) !== toKobo(expectedHostCharge.total)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "failed",
          message: "Host registration amount mismatch",
          expected: toKobo(expectedHostCharge.total)
        })
      };
    }

    if (String(verified.customer?.email || "").toLowerCase() !== normalizeEmail(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Payment email mismatch" })
      };
    }

    const startsAt = parseDateTimeInput(
      eventData.startsAt || (eventData.date && eventData.time ? `${eventData.date}T${eventData.time}` : null)
    );
    const endsAt = parseDateTimeInput(eventData.endsAt || null);
    const capacityValue = toNumber(eventData.capacity, 0);
    const capacity = capacityValue > 0 ? Math.floor(capacityValue) : null;
    const tiers = Array.isArray(eventData.tiers)
      ? eventData.tiers
          .map((tier, index) => ({
            id: normalizeText(tier.id) || `tier-${index + 1}`,
            name: normalizeText(tier.name) || `Tier ${index + 1}`,
            price: Math.max(0, toNumber(tier.price, 0)),
            description: normalizeText(tier.description),
            quantityLimit: toNumber(tier.quantityLimit, 0) > 0 ? Math.floor(toNumber(tier.quantityLimit, 0)) : null
          }))
          .filter((tier) => tier.name)
      : [];
    // Enforce reasonable limits to avoid abuse
    const MAX_TIERS = 10;
    if (tiers.length > MAX_TIERS) {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Too many ticket tiers' }) };
    }
    const attendeeFields = Array.isArray(eventData.attendeeFields)
      ? eventData.attendeeFields
          .map((field, index) => ({
            id: normalizeText(field.id) || `field-${index + 1}`,
            label: normalizeText(field.label) || `Field ${index + 1}`,
            type: normalizeText(field.type) || "text",
            required: Boolean(field.required),
            options: normalizeList(field.options)
          }))
          .filter((field) => field.label)
      : [];
    if (attendeeFields.length > MAX_ATTENDEE_FIELDS) {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Too many attendee fields' }) };
    }

    if (String(eventData.title || '').length > MAX_TITLE_LEN) {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Title too long' }) };
    }
    if (String(eventData.description || '').length > MAX_DESC_LEN) {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Description too long' }) };
    }

    const eventPayload = {
      title: normalizeText(eventData.title || "Untitled event"),
      description: normalizeText(eventData.description || ""),
      category: normalizeText(eventData.category || "General"),
      hostName: normalizeText(eventData.hostName || eventData.organizerName || user.name || ""),
      hostUid: user.uid,
      hostEmail: normalizeEmail(email),
      location: normalizeText(eventData.location || "Online / TBD"),
      venue: normalizeText(eventData.venue || ""),
      about: normalizeText(eventData.about || ""),
      dressCode: normalizeText(eventData.dressCode || ""),
      requirements: normalizeList(eventData.requirements || []),
      thingsToBring: normalizeList(eventData.thingsToBring || []),
      mediaUrls: (normalizeList(eventData.mediaUrls || [])).slice(0, MAX_MEDIA),
      ticketPrice: Math.max(0, toNumber(eventData.ticketPrice, 0)),
      ticketLabel: normalizeText(eventData.ticketLabel || "General admission"),
      isFree: Boolean(eventData.isFree),
      ticketMode: normalizeText(eventData.ticketMode || "single"),
      minTicketsPerOrder: Math.max(1, Math.floor(toNumber(eventData.minTicketsPerOrder, 1))),
      maxTicketsPerOrder: Math.max(1, Math.floor(toNumber(eventData.maxTicketsPerOrder, 10))),
      tiers,
      attendeeFields,
      capacity,
      startsAt: startsAt ? admin.firestore.Timestamp.fromDate(startsAt) : admin.firestore.FieldValue.serverTimestamp(),
      endsAt: endsAt ? admin.firestore.Timestamp.fromDate(endsAt) : null,
      imageUrl: normalizeText(eventData.imageUrl || ""),
      videoUrl: normalizeText(eventData.videoUrl || ""),
      status: "published",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      hostFeePaid: Number(amount),
      paystackReference: String(reference),
      sold: 0,
      attendees: 0
    };

    // Atomically reserve the payment reference and create the event
    const paymentsRef = db.collection('payments').doc(String(reference));
    const newEventRef = db.collection('events').doc();

    await db.runTransaction(async (tx) => {
      const paySnap = await tx.get(paymentsRef);
      if (paySnap.exists) {
        throw new Error('This payment reference has already been used');
      }
      tx.set(paymentsRef, {
        reference: String(reference),
        hostUid: user.uid,
        amount: Number(amount),
        email: normalizeEmail(email),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      tx.set(newEventRef, eventPayload);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        eventId: newEventRef.id,
        hostUid: user.uid,
        expectedHostCharge: expectedHostCharge.total
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", message: error.message })
    };
  }
};
