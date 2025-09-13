// worker/signal_worker.js
const { users } = require('../packages/lib/db');
const { fetchLatestSignal } = require('../packages/lib/signal');
const { openFromSignal } = require('../packages/lib/hlTrade');


const INTERVAL_MIN = Number(process.env.SIGNAL_POLL_MIN || 30);


async function tick(){
try{
const s = await fetchLatestSignal();
if (!s.ok) {
console.log(`[signals] none available: ${s.reason || 'n/a'}`);
return;
}


// Log prediction to console every cycle
console.log(`\n[signals] ${new Date().toISOString()} :: signal=${s.slot.signal} price=${s.slot.forecast_price} hash=${s.sigHash}`);


// Find all users that connected HL
const col = await users();
const cursor = col.find({ hlSecretCipher: { $exists: true } });
const usersAll = await cursor.toArray();


for (const u of usersAll) {
const last = u.lastSignalMeta || {};
if (last.sigHash === s.sigHash) {
console.log(`[skip] ${u.telegramId}: same signal hash (${s.sigHash.slice(0,8)}…)`);
continue; // unchanged — skip trading
}


// Only trade when signal is LONG/SHORT
if (s.slot.signal !== 'LONG' && s.slot.signal !== 'SHORT') {
console.log(`[hold] ${u.telegramId}: signal=${s.slot.signal}`);
// still update last seen so we don't repeat logs forever
await col.updateOne({ telegramId: u.telegramId }, { $set: { lastSignalMeta: { sigHash: s.sigHash, ts: s.ts } } });
continue;
}


try{
const exec = await openFromSignal(u.telegramId, s.slot);
if (exec && !exec.skipped) {
console.log(`[trade] ${u.telegramId}: ${exec.side} size=${exec.size} lev=${exec.leverage} addr=${exec.address}`);
await col.updateOne(
{ telegramId: u.telegramId },
{ $set: { lastSignalMeta: { sigHash: s.sigHash, ts: s.ts, lastSide: exec.side, lastSize: exec.size } } }
);
} else {
console.log(`[skip] ${u.telegramId}: ${exec?.reason || 'HOLD'}`);
await col.updateOne({ telegramId: u.telegramId }, { $set: { lastSignalMeta: { sigHash: s.sigHash, ts: s.ts } } });
}
} catch(e){
console.error(`[error] ${u.telegramId}:`, e.message);
}
}
}catch(e){
console.error('[worker] tick error:', e);
}
}


(async function main(){
console.log(`[worker] signal polling every ${INTERVAL_MIN} minutes`);
await tick();
setInterval(tick, INTERVAL_MIN * 60 * 1000);
})();
