const crypto = require('crypto');

const signaturesMatch = (expected, received) => {
  if (typeof expected !== 'string' || typeof received !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length === 0 || expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const capturedMatchesStored = (payment, entity) => {
  if (!payment || !entity) return false;
  const amount = Number(entity.amount);
  const currency = String(entity.currency || '').toUpperCase();
  const storedCurrency = String(payment.currency || 'INR').toUpperCase();
  return Number.isFinite(amount) && amount === Number(payment.amount) && currency === storedCurrency;
};

module.exports = {
  signaturesMatch,
  capturedMatchesStored,
};
