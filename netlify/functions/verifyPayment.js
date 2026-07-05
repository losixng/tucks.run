exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { reference, amount, email } = JSON.parse(event.body || "{}");
    const paystackReference = String(reference || "").trim();
    const expectedAmount = Number(amount);
    if (!paystackReference) {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Missing reference" }) };
    }

    if (Number.isNaN(expectedAmount) || expectedAmount <= 0) {
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
      return { statusCode: 502, body: JSON.stringify({ status: "failed", message: "Paystack verification failed", data: errorBody }) };
    }

    const data = await res.json();
    const paystackStatus = String(data?.data?.status || data?.status || "").toLowerCase();
    const verifiedAmount = Number(data?.data?.amount ?? data?.amount ?? 0);
    const paystackCustomerEmail = String(data?.data?.customer?.email || data?.customer?.email || "").trim().toLowerCase();

    if (paystackStatus !== "success") {
      return { statusCode: 400, body: JSON.stringify({ status: "failed", message: "Payment not successful", data: data?.data || data }) };
    }

    if (verifiedAmount !== expectedAmount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Amount mismatch", data: data?.data || data })
      };
    }

    const expectedEmail = String(email || "").trim().toLowerCase();
    if (expectedEmail && paystackCustomerEmail && paystackCustomerEmail !== expectedEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "failed", message: "Email mismatch", data: data?.data || data })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", message: "Payment verified", data: data?.data || data, raw: data })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ status: "failed", message: err.message }) };
  }
};
