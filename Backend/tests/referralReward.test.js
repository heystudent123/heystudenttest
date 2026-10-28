const test = require('node:test');
const assert = require('node:assert/strict');
const { priceAfterPercent, parseRewardPercent } = require('../utils/referralReward');

test('a student referral percent comes off the next purchase and never drops it below one rupee', () => {
  assert.equal(priceAfterPercent(1000, 10), 900);
  assert.equal(priceAfterPercent(999, 15), 849.15);
  assert.equal(priceAfterPercent(1000, 100), 1);
  assert.equal(priceAfterPercent(1000, 0), 1000);
});

test('the admin reward percent must be from 0 to 100', () => {
  assert.equal(parseRewardPercent('10'), 10);
  assert.equal(parseRewardPercent(12.556), 12.56);
  assert.equal(parseRewardPercent(-1), null);
  assert.equal(parseRewardPercent(101), null);
});
