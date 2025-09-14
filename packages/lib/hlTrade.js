// const { users } = require('./db');
// const { roflDecrypt } = require('../../bot/roflClient');
// const { Wallet } = require('ethers');
// const { Hyperliquid } = require('hyperliquid');
// const fetch = require('node-fetch');
// const { getRisk, useDefault } = require('./risk');

// /* ------------------------- user + address helpers ------------------------- */

// async function getUserSecretsAndAddrs(telegramId) {
//   const col = await users();
//   const u = await col.findOne({ telegramId: String(telegramId) });
//   if (!u || !u.hlSecretCipher) throw new Error('Connect HL first.');

//   const { iv, tag, ciphertext } = u.hlSecretCipher;
//   const out = await roflDecrypt(String(telegramId), iv, tag, ciphertext);
//   const sk = String(out.plaintext || '').trim();
//   if (!sk) throw new Error('HL secret decrypt failed.');

//   // Addresses saved in Mongo by your Connect flow
//   const apiAddr  = u.hlAddress || null;
//   const mainAddr = u.hlMainAddress || null;
//   if (!apiAddr && !mainAddr) {
//     throw new Error('No HL addresses saved. Tap “Connect HL”.');
//   }

//   return { sk, apiAddr, mainAddr, userDoc: u };
// }

// async function ensureRisk(telegramId) {
//   let r = await getRisk(telegramId);
//   if (!r) r = await useDefault(telegramId);
//   return r;
// }

// /* ----------------------------- HL utils ---------------------------------- */

// async function getAvailableUSDC(address) {
//   const req = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'clearinghouseState', user: address })
//   });
//   const j = await req.json();
//   const acct = parseFloat(j?.marginSummary?.accountValue || '0');
//   const withdrawable = parseFloat((j.withdrawable ?? j.marginSummary?.accountValue) || '0');
//   return { accountValue: acct, available: withdrawable };
// }

// function roundLot(size, lot = 0.00001, min = 0.0001) {
//   const lots = Math.max(Math.floor(size / lot), Math.ceil(min / lot));
//   return lots * lot;
// }

// function computeSize(price, risk, availableUSDC, confidence = 85) {
//   const capital = availableUSDC * (risk.capitalUsagePercent || 0.3);
//   let lev = risk.minLeverage || 5;
//   if (confidence >= 95) lev = risk.maxLeverage || 25;
//   else if (confidence >= 90) lev = Math.round((risk.maxLeverage || 25) * 0.8);
//   else if (confidence >= 85) lev = Math.round((risk.maxLeverage || 25) * 0.6);
//   const notional = capital * lev;
//   const sz = notional / price;
//   return { size: roundLot(sz), leverage: lev, notional, capital };
// }

// function mkSdk(sk, addr) {
//   return new Hyperliquid({ privateKey: sk, walletAddress: addr, testnet: false });
// }

// async function placeOrder({ sdk, coin, isBuy, size, aggressivePx, reduceOnly = false }) {
//   const params = {
//     coin,
//     is_buy: isBuy,
//     sz: Number(size),
//     limit_px: Math.round(aggressivePx),
//     order_type: { limit: { tif: 'Ioc' } },
//     reduce_only: !!reduceOnly
//   };
//   const r = await sdk.exchange.placeOrder(params);
//   return r;
// }

// async function quoteAggressivePx(coin, side) {
//   const r = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'l2Book', coin, nSigFigs: 5 })
//   });
//   const j = await r.json();
//   if (side === 'buy'  && j?.levels?.[0]?.[0]) return parseFloat(j.levels[0][0].px) * 1.01;
//   if (side === 'sell' && j?.levels?.[1]?.[0]) return parseFloat(j.levels[1][0].px) * 0.99;
//   const mids = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'allMids' })
//   }).then(x => x.json());
//   const mid = mids['BTC'];
//   return side === 'buy' ? mid * 1.02 : mid * 0.98;
// }

// /* ------------------------------ Trading ---------------------------------- */

// async function tryPlaceWithAddress({ sk, address, slot, risk }) {
//   // 1) margin check for this address
//   const bal = await getAvailableUSDC(address);
//   if (bal.available < 10) {
//     return { ok: false, reason: 'INSUFFICIENT_MARGIN', detail: { address, bal } };
//   }

//   // 2) sizing
//   const coin = 'BTC-PERP';
//   const price = Number(slot.forecast_price);
//   const conf = (slot.confidence_90 && slot.confidence_90[1]) || 85;
//   const { size, leverage, notional } = computeSize(price, risk, bal.available, conf);

//   // 3) side
//   const sideBuy  = slot.signal === 'LONG';
//   const sideSell = slot.signal === 'SHORT';
//   if (!sideBuy && !sideSell) return { ok: true, skipped: true, reason: 'HOLD' };

//   // 4) place aggressively
//   const sdk = mkSdk(sk, address);
//   const px = await quoteAggressivePx('BTC', sideBuy ? 'buy' : 'sell');

//   const result = await placeOrder({
//     sdk,
//     coin,
//     isBuy: sideBuy,
//     size,
//     aggressivePx: px,
//     reduceOnly: false
//   });

//   if (result?.status === 'ok') {
//     return {
//       ok: true,
//       skipped: false,
//       exec: {
//         result, address, size, leverage, notional, priceTarget: price,
//         side: sideBuy ? 'LONG' : 'SHORT', used: address
//       }
//     };
//   }

//   // Common HL error if addr/key mismatch: "User or API Wallet ... does not exist."
//   return { ok: false, reason: 'HL_ERROR', detail: { address, result } };
// }

// async function openFromSignal(telegramId, slot) {
//   const { sk, apiAddr, mainAddr } = await getUserSecretsAndAddrs(telegramId);
//   const risk = await ensureRisk(telegramId);

//   // Respect order: API wallet first, then Main as fallback
//   const addressesToTry = [];
//   if (apiAddr)  addressesToTry.push({ which: 'API',  addr: apiAddr });
//   if (mainAddr) addressesToTry.push({ which: 'MAIN', addr: mainAddr });

//   const errors = [];
//   for (const entry of addressesToTry) {
//     const r = await tryPlaceWithAddress({ sk, address: entry.addr, slot, risk });
//     if (r.ok && r.skipped) return { skipped: true, reason: 'HOLD' };
//     if (r.ok && !r.skipped) {
//       // annotate which wallet we used
//       r.exec.wallet = entry.which;
//       return r.exec;
//     }
//     errors.push({ wallet: entry.which, reason: r.reason, detail: r.detail });
//   }

//   // If we got here, neither address worked
//   const msg = errors.map(e => `${e.wallet}: ${e.reason}`).join(' | ');
//   throw new Error(msg || 'Trade failed for all addresses.');
// }

// /* ------------------------------ Close All -------------------------------- */

// async function closeAll(telegramId) {
//   const { sk, apiAddr, mainAddr } = await getUserSecretsAndAddrs(telegramId);

//   async function closeFor(address) {
//     const sdk = mkSdk(sk, address);
//     const st = await fetch('https://api.hyperliquid.xyz/info', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ type: 'clearinghouseState', user: address })
//     }).then(r => r.json());

//     const pos = Array.isArray(st?.assetPositions) ? st.assetPositions : [];
//     let n = 0; const results = [];
//     for (const p of pos) {
//       if (!p?.position) continue;
//       const coinSym = p.position.coin + '-PERP';
//       const size = Math.abs(parseFloat(p.position.szi));
//       if (size <= 0) continue;
//       const isLong = parseFloat(p.position.szi) > 0;
//       const px = await quoteAggressivePx(p.position.coin, isLong ? 'sell' : 'buy');
//       const r = await placeOrder({ sdk, coin: coinSym, isBuy: !isLong, size, aggressivePx: px, reduceOnly: true });
//       results.push({ wallet: address, coin: coinSym, closed: size, tx: r }); n++;
//     }
//     return { address, closed: n, results };
//   }

//   const outs = [];
//   if (apiAddr)  outs.push(await closeFor(apiAddr));
//   if (mainAddr && mainAddr.toLowerCase() !== apiAddr?.toLowerCase()) {
//     outs.push(await closeFor(mainAddr));
//   }
//   return outs;
// }

// module.exports = { openFromSignal, closeAll };

// packages/lib/hlTrade.js
// packages/lib/hlTrade.js
// AVAX-first trading utils: read HL addresses directly from Mongo (no derivation)
// and place orders on AVAX-PERP using per-user secret decrypted via ROFL.

const { users } = require('./db');
const { roflDecrypt } = require('../../bot/roflClient');
const { Wallet } = require('ethers');               // v5 is fine
const { Hyperliquid } = require('hyperliquid');
const fetch = require('node-fetch');
const { getRisk, useDefault } = require('./risk');

/* ------------------------- user + address helpers ------------------------- */

async function getUserSecretsAndAddrs(telegramId) {
  const col = await users();
  const u = await col.findOne({ telegramId: String(telegramId) });
  if (!u || !u.hlSecretCipher) throw new Error('Connect HL first.');

  // decrypt secret (used to sign HL API requests)
  const { iv, tag, ciphertext } = u.hlSecretCipher;
  const out = await roflDecrypt(String(telegramId), iv, tag, ciphertext);
  const sk = String(out.plaintext || '').trim();
  if (!sk) throw new Error('HL secret decrypt failed.');

  // addresses are taken ONLY from Mongo (saved during Connect flow)
  const apiAddr  = u.hlAddress || null;       // Hyperliquid API wallet address
  const mainAddr = u.hlMainAddress || null;   // Your “main” wallet address

  if (!apiAddr && !mainAddr) {
    throw new Error('No HL addresses saved. Tap “Connect HL”.');
  }

  return { sk, apiAddr, mainAddr, userDoc: u };
}

async function ensureRisk(telegramId) {
  let r = await getRisk(telegramId);
  if (!r) r = await useDefault(telegramId);
  return r;
}

/* ----------------------------- HL utils ---------------------------------- */

async function getAvailableUSDC(address) {
  const req = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: address })
  });
  const j = await req.json();
  const acct = parseFloat(j?.marginSummary?.accountValue || '0');
  const withdrawable = parseFloat((j.withdrawable ?? j.marginSummary?.accountValue) || '0');
  return { accountValue: acct, available: withdrawable };
}

// lot sizes (tuned for AVAX)
const LOTS = {
  'AVAX-PERP': { lot: 0.01, min: 0.1 },
  'BTC-PERP':  { lot: 0.00001, min: 0.0001 },
};
function roundLot(size, coin = 'AVAX-PERP') {
  const { lot, min } = LOTS[coin] || { lot: 0.01, min: 0.1 };
  const lots = Math.max(Math.floor(size / lot), Math.ceil(min / lot));
  return Number((lots * lot).toFixed(8));
}

// 5% capital usage (you asked to reduce from 30% → 5%)
function computeSize(price, risk, availableUSDC, confidence = 85, coin = 'AVAX-PERP') {
  const capPct = (typeof risk.capitalUsagePercent === 'number')
    ? risk.capitalUsagePercent
    : 0.05; // default 5%
  const capital = availableUSDC * capPct;

  let lev = risk.minLeverage || 5;
  if (confidence >= 95) lev = risk.maxLeverage || 25;
  else if (confidence >= 90) lev = Math.round((risk.maxLeverage || 25) * 0.8);
  else if (confidence >= 85) lev = Math.round((risk.maxLeverage || 25) * 0.6);

  const notional = capital * lev;
  const sz = notional / price;
  return { size: roundLot(sz, coin), leverage: lev, notional, capital };
}

function mkSdk(sk, addr) {
  return new Hyperliquid({ privateKey: sk, walletAddress: addr, testnet: false });
}

async function placeOrder({ sdk, coin, isBuy, size, aggressivePx, reduceOnly = false }) {
  const params = {
    coin,
    is_buy: isBuy,
    sz: Number(size),
    // AVAX works fine with 2 decimals for an aggressive IOC
    limit_px: Math.round(Number(aggressivePx) * 100) / 100,
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: !!reduceOnly
  };
  return sdk.exchange.placeOrder(params);
}

async function quoteAggressivePx(spotSymbol, side) {
  // Fast and simple: cross the spread using allMids
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' })
  });
  const mids = await r.json();
  const mid = Number(mids[spotSymbol]);
  if (!mid) throw new Error(`No mid price for ${spotSymbol}`);
  return side === 'buy' ? mid * 1.01 : mid * 0.99;
}

/* ------------------------------ Trading ---------------------------------- */

async function tryPlaceWithAddress({ sk, address, slot, risk, coin = 'AVAX-PERP' }) {
  // 1) margin check for this address
  const bal = await getAvailableUSDC(address);
  if (bal.available < 10) {
    return { ok: false, reason: 'INSUFFICIENT_MARGIN', detail: { address, bal } };
  }

  // 2) sizing
  const price = Number(slot.forecast_price);
  const conf = (slot.confidence_90 && slot.confidence_90[1]) || 85;
  const { size, leverage, notional } = computeSize(price, risk, bal.available, conf, coin);

  // 3) side
  const sideBuy  = slot.signal === 'LONG';
  const sideSell = slot.signal === 'SHORT';
  if (!sideBuy && !sideSell) return { ok: true, skipped: true, reason: 'HOLD' };

  // 4) place aggressively on AVAX-PERP
  const spot = coin.replace('-PERP', ''); // "AVAX"
  const sdk = mkSdk(sk, address);
  const px = await quoteAggressivePx(spot, sideBuy ? 'buy' : 'sell');

  const result = await placeOrder({
    sdk,
    coin,
    isBuy: sideBuy,
    size,
    aggressivePx: px,
    reduceOnly: false
  });

  if (result?.status === 'ok') {
    return {
      ok: true,
      skipped: false,
      exec: {
        result,
        address,
        size,
        leverage,
        notional,
        priceTarget: price,
        side: sideBuy ? 'LONG' : 'SHORT',
        used: address,
        orderId: result?.response?.oid || null,
      }
    };
  }

  // Common HL error if addr/key mismatch: "User or API Wallet ... does not exist."
  return { ok: false, reason: 'HL_ERROR', detail: { address, result } };
}

async function openFromSignal(telegramId, slot, opts = {}) {
  const coin = opts.coin || 'AVAX-PERP';
  const { sk, apiAddr, mainAddr } = await getUserSecretsAndAddrs(telegramId);
  const risk = await ensureRisk(telegramId);

  // Try API wallet first, then Main as fallback
  const attempts = [];
  if (apiAddr)  attempts.push({ which: 'API',  addr: apiAddr });
  if (mainAddr && (!apiAddr || mainAddr.toLowerCase() !== apiAddr.toLowerCase())) {
    attempts.push({ which: 'MAIN', addr: mainAddr });
  }

  const errors = [];
  for (const a of attempts) {
    const r = await tryPlaceWithAddress({ sk, address: a.addr, slot, risk, coin });
    if (r.ok && r.skipped) return { skipped: true, reason: 'HOLD' };
    if (r.ok && !r.skipped) {
      r.exec.wallet = a.which;
      return r.exec;
    }
    errors.push({ wallet: a.which, reason: r.reason, detail: r.detail });
  }

  const msg = errors.map(e => `${e.wallet}: ${e.reason}`).join(' | ');
  throw new Error(msg || 'Trade failed for all addresses.');
}

/* ------------------------------ Close All -------------------------------- */

async function closeAll(telegramId) {
  const { sk, apiAddr, mainAddr } = await getUserSecretsAndAddrs(telegramId);

  async function closeFor(address) {
    const sdk = mkSdk(sk, address);
    const st = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address })
    }).then(r => r.json());

    const pos = Array.isArray(st?.assetPositions) ? st.assetPositions : [];
    let n = 0; const results = [];
    for (const p of pos) {
      if (!p?.position) continue;
      const coinSym = p.position.coin + '-PERP';
      const size = Math.abs(parseFloat(p.position.szi));
      if (size <= 0) continue;
      const isLong = parseFloat(p.position.szi) > 0;
      const px = await quoteAggressivePx(p.position.coin, isLong ? 'sell' : 'buy');
      const r = await placeOrder({ sdk, coin: coinSym, isBuy: !isLong, size, aggressivePx: px, reduceOnly: true });
      results.push({ wallet: address, coin: coinSym, closed: size, tx: r }); n++;
    }
    return { address, closed: n, results };
  }

  const outs = [];
  if (apiAddr)  outs.push(await closeFor(apiAddr));
  if (mainAddr && (!apiAddr || mainAddr.toLowerCase() !== apiAddr.toLowerCase())) {
    outs.push(await closeFor(mainAddr));
  }
  return outs;
}

module.exports = { openFromSignal, closeAll };
