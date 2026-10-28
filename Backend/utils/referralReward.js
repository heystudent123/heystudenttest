function priceAfterReward(price, rewardAmount) {
  const base = Number(price);
  const reward = Number(rewardAmount);
  if (!Number.isFinite(base) || base <= 0) return base;
  if (!Number.isFinite(reward) || reward <= 0) return base;
  const discounted = Math.round((base - reward) * 100) / 100;
  return Math.max(1, discounted);
}

function priceAfterPercent(price, percent) {
  const base = Number(price);
  const rate = Number(percent);
  if (!Number.isFinite(base) || base <= 0) return base;
  if (!Number.isFinite(rate) || rate <= 0) return base;
  const discounted = Math.round(base * (1 - Math.min(rate, 100) / 100) * 100) / 100;
  return Math.max(1, discounted);
}

function parseRewardPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return Math.round(number * 100) / 100;
}

module.exports = { priceAfterReward, priceAfterPercent, parseRewardPercent };
