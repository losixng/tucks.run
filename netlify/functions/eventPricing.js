const DEFAULT_HOST_FEE = Number(process.env.EVENT_HOST_FEE_NAIRA || 500);
const DEFAULT_ATTENDEE_FEE = Number(process.env.EVENT_ATTENDEE_FEE_NAIRA || 100);
const DEFAULT_GATEWAY_PERCENT = Number(process.env.EVENT_GATEWAY_PERCENT || 1.5);
const DEFAULT_GATEWAY_FLAT = Number(process.env.EVENT_GATEWAY_FLAT_NAIRA || 100);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function gatewayFee(amount) {
  const normalizedAmount = Math.max(0, toNumber(amount, 0));
  const rawFee = normalizedAmount * (DEFAULT_GATEWAY_PERCENT / 100) + DEFAULT_GATEWAY_FLAT;
  return Math.max(0, Math.round(rawFee));
}

function toKobo(amount) {
  return Math.max(0, Math.round(toNumber(amount, 0) * 100));
}

function calculateHostCharge() {
  const base = DEFAULT_HOST_FEE;
  const fee = gatewayFee(base);
  return {
    base,
    gatewayFee: fee,
    total: base + fee
  };
}

function calculateAttendeeCharge(baseAmount, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));
  const ticketSubtotal = Math.max(0, toNumber(baseAmount, 0)) * safeQuantity;
  const registrationFee = DEFAULT_ATTENDEE_FEE * safeQuantity;
  const chargeableAmount = ticketSubtotal + registrationFee;
  const fee = gatewayFee(chargeableAmount);

  return {
    quantity: safeQuantity,
    ticketSubtotal,
    registrationFee,
    gatewayFee: fee,
    total: chargeableAmount + fee
  };
}

module.exports = {
  calculateAttendeeCharge,
  calculateHostCharge,
  gatewayFee,
  toKobo,
  toNumber
};
