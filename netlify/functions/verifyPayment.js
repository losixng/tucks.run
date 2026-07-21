exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "{}");
    const { reference, amount, email } = JSON.parse(rawBody);
    const paystackReference = String(reference || "").trim();
    const expectedAmount = Math.round(Number(amount));

    if (!paystackReference) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing reference" }) };
    }

    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Invalid amount" }) };
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ status: "failed", message: "PAYSTACK_SECRET_KEY not configured" })
      };
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(paystackReference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return {
        statusCode: 502,
        body: JSON.stringify({ status: "failed", message: "Paystack verification failed", data: errorBody })
      };
    }

    const data = await res.json();
    const tx = data?.data || {};
    const paystackStatus = String(tx.status || data?.status || "").toLowerCase();
    // `amount` is what the customer paid (may include fees passed to customer).
    // `requested_amount` is what we initialized the charge with — that is what we must match.
    const paidAmount = Math.round(Number(tx.amount ?? data?.amount ?? 0));
    const requestedAmount = Math.round(Number(
      tx.requested_amount ?? data?.requested_amount ?? paidAmount
    ));

    if (paystackStatus !== "success") {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Payment not successful", data: tx || data })
      };
    }

    if (requestedAmount !== expectedAmount) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "failed",
          message: "Amount mismatch",
          expectedAmount,
          requestedAmount,
          paidAmount,
          data: tx || data
        })
      };
    }

    const paystackCustomerEmail = String(tx.customer?.email || data?.customer?.email || "").trim().toLowerCase();
    const expectedEmail = String(email || "").trim().toLowerCase();
    if (expectedEmail && paystackCustomerEmail && paystackCustomerEmail !== expectedEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Email mismatch", data: tx || data })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: "Payment verified",
        data: tx || data,
        raw: data
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: "failed", message: err.message }) };
  }
};
