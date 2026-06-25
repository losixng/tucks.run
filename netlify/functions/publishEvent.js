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
      mediaUrls: normalizeList(eventData.mediaUrls || []),
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

    const docRef = await db.collection("events").add(eventPayload);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        eventId: docRef.id,
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
