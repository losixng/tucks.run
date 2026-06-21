const verifyPaystackReference = async (reference) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Paystack verification failed: ${errorBody}`);
  }

  const payload = await response.json();
  if (!payload.status || payload.data?.status !== "success") {
    throw new Error("Paystack transaction not successful");
  }

  return payload.data;
};

const parseJsonBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
};

module.exports = { verifyPaystackReference, parseJsonBody };