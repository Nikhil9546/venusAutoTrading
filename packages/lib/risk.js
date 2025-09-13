// packages/lib/risk.js
// Handles storing/retrieving risk strategy for each user.

const { users } = require('./db');

const DEFAULT_ZKAGI = {
  capitalUsagePercent: 0.30,
  maxLeverage: 25,
  minLeverage: 5,
  maxProfit: 100,
  quickProfit: 50,
  maxLoss: 20,
  dayLoss: 100
};

async function setRisk(telegramId, risk) {
  const col = await users();
  await col.updateOne(
    { telegramId: String(telegramId) },
    { $set: { riskStrategy: risk } },
    { upsert: true }
  );
}

async function getRisk(telegramId) {
  const col = await users();
  const u = await col.findOne({ telegramId: String(telegramId) });
  return u?.riskStrategy || null;
}

async function useDefault(telegramId) {
  await setRisk(telegramId, DEFAULT_ZKAGI);
  return DEFAULT_ZKAGI;
}

function formatRisk(r) {
  return `*Risk Setup*\n` +
    `• Capital Usage: ${(r.capitalUsagePercent*100).toFixed(0)}%\n` +
    `• Leverage: ${r.minLeverage}x – ${r.maxLeverage}x\n` +
    `• Max Profit: $${r.maxProfit}\n` +
    `• Quick Profit: $${r.quickProfit}\n` +
    `• Max Loss: $${r.maxLoss}\n` +
    `• Daily Loss Limit: $${r.dayLoss}`;
}

module.exports = { setRisk, getRisk, useDefault, formatRisk, DEFAULT_ZKAGI };

