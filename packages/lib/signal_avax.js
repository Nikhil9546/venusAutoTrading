// packages/lib/signal_avax.js
const fetch = require('node-fetch');
const crypto = require('crypto');

// stable hash for dedupe
function hashSignal(slot){
  const o = {
    symbol: 'AVAX',
    signal: slot?.signal,
    price: slot?.forecast_price,
    hour: slot?.time || Math.floor(Date.now() / 3600000),
  };
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

/**
 * Fetch the latest AVAX forecast from your endpoint.
 * Returns { ok, slot, sigHash, ts } where slot has
 *   { time, signal, forecast_price, ... }
 */
async function fetchLatestAvaxSignal() {
  const url = process.env.AVAX_SIGNAL_URL;

  const r = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
  if (!r.ok) return { ok: false, reason: `Signal API ${r.status}` };

  const j = await r.json();
  const slot = j?.avax_forecast;
  if (!slot || !slot.signal || typeof slot.forecast_price === 'undefined') {
    return { ok: false, reason: 'No usable AVAX slot' };
  }
  const sigHash = hashSignal(slot);
  return { ok: true, slot, sigHash, ts: Date.now() };
}

module.exports = { fetchLatestAvaxSignal, hashSignal };

