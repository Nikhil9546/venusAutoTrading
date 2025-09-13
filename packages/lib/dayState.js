const { dayStates } = require('./db');
function todayStr() { return new Date().toISOString().slice(0,10); }
async function getDayState(telegramId) {
  const col = await dayStates(); const day = todayStr();
  let row = await col.findOne({ telegramId, day });
  if (!row) { row = { telegramId, day, realizedProfit:0, realizedLoss:0, trades:[] }; await col.insertOne(row); }
  return row;
}
async function pushTrade(telegramId, trade) {
  const col = await dayStates(); const day = todayStr();
  await col.updateOne(
    { telegramId, day },
    { $push: { trades: trade },
      $inc: { realizedProfit: Math.max(trade.pnl,0), realizedLoss: Math.max(-trade.pnl,0) } },
    { upsert: true }
  );
}
module.exports = { getDayState, pushTrade };
