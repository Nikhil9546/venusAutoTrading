// packages/lib/signal.js
const fetch = require('node-fetch');
const crypto = require('crypto');


function hashSignal(slot){
const o = {
signal: slot?.signal,
price: slot?.forecast_price,
// include rounded hour to avoid tiny timestamp jitter if API returns same hour
hour: slot?.ts || Math.floor(Date.now() / 3600000)
};
return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}


async function fetchLatestSignal() {
const apiKey = process.env.ZKAGI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
if (!apiKey) throw new Error('Signal API key missing (ZKAGI_API_KEY).');


const r = await fetch('https://zynapse.zkagi.ai/today', {
method: 'GET',
headers: { 'accept': 'application/json', 'api-key': apiKey },
});
if (!r.ok) throw new Error(`Signal API ${r.status}`);


const j = await r.json();
const arr = Array.isArray(j.forecast_today_hourly) ? j.forecast_today_hourly : [];
const slot = arr.length ? arr[arr.length - 1] : null;


if (!slot || !slot.signal || !slot.forecast_price) {
return { ok: false, reason: 'No usable signal' };
}
const sigHash = hashSignal(slot);
const ts = Date.now();
return { ok: true, slot, sigHash, ts };
}


module.exports = { fetchLatestSignal, hashSignal };
