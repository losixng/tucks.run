const { calculateAttendeeCharge, calculateHostCharge } = require("./eventPricing");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const sampleAttendeeCharge = calculateAttendeeCharge(0, 1);
  const hostCharge = calculateHostCharge();

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "success",
      attendeeRegistrationFee: sampleAttendeeCharge.registrationFee,
      hostRegistrationFee: hostCharge.base,
      hostGatewayFee: hostCharge.gatewayFee,
      gatewayFeeExample: sampleAttendeeCharge.gatewayFee,
      gatewayPercent: Number(process.env.EVENT_GATEWAY_PERCENT || 1.5),
      gatewayFlat: Number(process.env.EVENT_GATEWAY_FLAT_NAIRA || 100)
    })
  };
};
