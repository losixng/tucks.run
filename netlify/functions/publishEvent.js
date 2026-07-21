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
    const { reference, amount, email, eventData, receiptUrl } = parseJsonBody(event);
    const isFreeEvent = Boolean(eventData?.isFree);
    const hasReceipt = Boolean(String(receiptUrl || '').trim());

    if (!email || !eventData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Missing email or event details" })
      };
    }

    if (!String(eventData.category || '').trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Please choose a category for the event" })
      };
    }

    if (normalizeEmail(user.email || email) !== normalizeEmail(email)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ status: "failed", message: "Event payment email must match the signed-in account" })
      };
    }

    const expectedHostCharge = calculateHostCharge();
    let verified = null;
    if (!isFreeEvent && reference) {
      verified = await verifyPaystackReference(reference);
    }

    // Validation limits
    const MAX_TIERS = 10;
    const MAX_MEDIA = 10;
    const MAX_ATTENDEE_FIELDS = 20;
    const MAX_TITLE_LEN = 200;
    const MAX_DESC_LEN = 5000;

    if (!isFreeEvent && !hasReceipt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Paid events require a receipt upload" })
      };
    }

    const paymentAccountName = normalizeText(eventData.paymentAccountName || "");
    const paymentAccountNumber = normalizeText(eventData.paymentAccountNumber || "");
    const paymentBankName = normalizeText(eventData.paymentBankName || "");
    if (!isFreeEvent && (!paymentAccountName || !paymentAccountNumber || !paymentBankName)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Paid events require account name, account number, and bank name" })
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
      paymentAccountName,
      paymentAccountNumber,
      paymentBankName,
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
      // default to pending for paid events so admin can verify receipt
      status: isFreeEvent ? "published" : "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      hostFeePaid: Number(amount) || 0,
      paystackReference: reference ? String(reference) : '',
      receiptUrl: normalizeText(receiptUrl || ''),
      reviewRequired: !isFreeEvent,
      submittedForReviewAt: admin.firestore.FieldValue.serverTimestamp(),
      pendingExpiresAt: isFreeEvent
        ? null
        : admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
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
      // record payment reference if provided
      if (reference) {
        tx.set(paymentsRef, {
          reference: String(reference),
          hostUid: user.uid,
          amount: Number(amount),
          email: normalizeEmail(email),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
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
