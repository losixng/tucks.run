const { authErrorResponse, requireDeliveryAgent } = require("./deliveryAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const user = await requireDeliveryAgent(event);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        allowed: true,
        user: {
          uid: user.uid,
          email: user.email || null
        }
      })
    };
  } catch (error) {
    return authErrorResponse(error);
  }
};
