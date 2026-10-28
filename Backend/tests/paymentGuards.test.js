const test = require('node:test');
const assert = require('node:assert/strict');
const { signaturesMatch, capturedMatchesStored } = require('../utils/paymentGuards');

test('signature compare rejects a different length before the timing-safe check', () => {
  assert.equal(signaturesMatch('abcd', 'abc'), false);
  assert.equal(signaturesMatch('abcd', 'abcd'), true);
  assert.equal(signaturesMatch('abcd', 'abce'), false);
  assert.equal(signaturesMatch('abcd', null), false);
});

test('captured webhook amount must match the stored order', () => {
  const payment = { amount: 100000, currency: 'INR' };
  assert.equal(capturedMatchesStored(payment, { amount: 100000, currency: 'INR' }), true);
  assert.equal(capturedMatchesStored(payment, { amount: 100, currency: 'INR' }), false);
  assert.equal(capturedMatchesStored(payment, { amount: 100000, currency: 'USD' }), false);
  assert.equal(capturedMatchesStored(payment, { amount: '100000', currency: 'inr' }), true);
});
