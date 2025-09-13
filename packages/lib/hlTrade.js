// const { users } = require('./db');
// const { roflDecrypt } = require('../../bot/roflClient');
// const { Hyperliquid } = require('hyperliquid');
// const fetch = require('node-fetch');
// const { getRisk, useDefault } = require('./risk');

// const MIN_ORDER_SIZE = 0.0001;     // HL BTC lot minimum
// const LOT_SIZE = 0.00001;          // rounding lot
// const FALLBACK_SIZE = 0.001;       // matches your test script
// const SAFETY_BUFFER = 0.97;        // leave room for fees/slippage when sizing

// // Use the address user pasted via Connect HL (do not derive from secret)
// async function getUserSecretAndAddress(telegramId) {
//   const col = await users();
//   const u = await col.findOne({ telegramId: String(telegramId) });
//   if (!u) throw new Error('User not found. Run /start.');
//   if (!u.hlSecretCipher) throw new Error('Connect HL first.');

//   const { iv, tag, ciphertext } = u.hlSecretCipher;
//   const out = await roflDecrypt(String(telegramId), iv, tag, ciphertext);
//   const sk = String(out.plaintext || '').trim();
//   if (!sk) throw new Error('HL secret decryption failed.');

//   const address = (u.hlAddress || '').trim();
//   if (!address) throw new Error('No HL address saved. Use “🔗 Connect HL”.');

//   return { sk, address };
// }

// async function ensureRisk(telegramId) {
//   let r = await getRisk(telegramId);
//   if (!r) r = await useDefault(telegramId);
//   return r;
// }

// async function getAvailableUSDC(address) {
//   const req = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'clearinghouseState', user: address })
//   });
//   const j = await req.json();
//   const accountValue = Number(j?.marginSummary?.accountValue ?? 0);
//   const withdrawable = Number(j?.withdrawable ?? j?.marginSummary?.accountValue ?? 0);

//   console.log('[HL DEBUG] address:', address);
//   console.log('[HL DEBUG] accountValue:', accountValue, 'withdrawable:', withdrawable);

//   return { accountValue, available: withdrawable };
// }

// function roundLot(x, lot = LOT_SIZE, min = MIN_ORDER_SIZE) {
//   const lots = Math.max(Math.floor(x / lot), Math.ceil(min / lot));
//   return lots * lot;
// }

// // Size requested by risk profile (before guardrails)
// function computeRiskSize(price, risk, availableUSDC, confidence = 85) {
//   const capitalUsage = (risk.capitalUsagePercent ?? 0.30); // fraction of availableUSDC to commit as initial margin
//   let lev = risk.minLeverage ?? 5;
//   const maxLev = risk.maxLeverage ?? 25;
//   if (confidence >= 95) lev = maxLev;
//   else if (confidence >= 90) lev = Math.round(maxLev * 0.8);
//   else if (confidence >= 85) lev = Math.round(maxLev * 0.6);

//   // initial margin = capitalUsage * availableUSDC
//   const initialMargin = availableUSDC * capitalUsage;
//   const notional = initialMargin * lev;
//   const size = notional / price;

//   return {
//     requestedSize: roundLot(size),
//     leverage: lev,
//     initialMargin,
//     notional
//   };
// }

// // Clamp requested size to what your *actual* withdrawable margin can support.
// function clampSizeByMargin(price, leverage, availableUSDC, requestedSize) {
//   // Max notional we can safely hold with available margin (with safety buffer)
//   const maxNotional = availableUSDC * leverage * SAFETY_BUFFER;
//   const maxSize = roundLot(maxNotional / price);

//   // Never below MIN_ORDER_SIZE
//   const clamped = Math.max(MIN_ORDER_SIZE, Math.min(requestedSize, maxSize));
//   return clamped;
// }

// function mkSdk(sk, addr) {
//   console.log('[HL DEBUG] SDK for', addr.slice(0, 6) + '…' + addr.slice(-4));
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
//   console.log('[HL DEBUG] placing order:', params);
//   const r = await sdk.exchange.placeOrder(params);
//   console.log('[HL DEBUG] placeOrder result:', r);
//   return r;
// }

// async function quoteAggressivePx(spotCoin, side) {
//   const r = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'l2Book', coin: spotCoin, nSigFigs: 5 })
//   });
//   const j = await r.json();
//   if (side === 'buy'  && j?.levels?.[0]?.[0]) return parseFloat(j.levels[0][0].px) * 1.01;
//   if (side === 'sell' && j?.levels?.[1]?.[0]) return parseFloat(j.levels[1][0].px) * 0.99;

//   const mids = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'allMids' })
//   }).then(x => x.json());
//   const mid = Number(mids[spotCoin]);
//   if (!mid) throw new Error('Could not fetch mid price');
//   return side === 'buy' ? mid * 1.02 : mid * 0.98;
// }

// function looksLikeInsufficientMargin(res) {
//   if (!res) return false;
//   if (typeof res === 'string') return /insufficient/i.test(res);
//   if (res.response && typeof res.response === 'string') return /insufficient/i.test(res.response);
//   if (res.error && typeof res.error === 'string') return /insufficient/i.test(res.error);
//   return false;
// }

// async function openFromSignal(telegramId, slot) {
//   const { sk, address } = await getUserSecretAndAddress(telegramId);
//   const risk = await ensureRisk(telegramId);
//   const bal = await getAvailableUSDC(address);

//   if (!Number.isFinite(bal.available)) throw new Error('Could not read HL margin.');
//   if (bal.available < 5) throw new Error('Insufficient margin on HL.');

//   const coin = 'BTC-PERP';               // trade perp
//   const spotCoin = 'BTC';                // quote for IOC aggression
//   const price = Number(slot.forecast_price);
//   const confidence = (Array.isArray(slot.confidence_90) && Number(slot.confidence_90[1])) || 85;

//   // Requested size from risk model
//   const base = computeRiskSize(price, risk, bal.available, confidence);

//   // Clamp by actual withdrawable margin
//   let size = clampSizeByMargin(price, base.leverage, bal.available, base.requestedSize);

//   const sideBuy = slot.signal === 'LONG';
//   const sideSell = slot.signal === 'SHORT';
//   if (!sideBuy && !sideSell) return { skipped: true, reason: 'HOLD' };

//   const sdk = mkSdk(sk, address);
//   const px = await quoteAggressivePx(spotCoin, sideBuy ? 'buy' : 'sell');

//   // Try once with sized amount; on margin error, retry with FALLBACK_SIZE.
//   let result = await placeOrder({
//     sdk, coin, isBuy: sideBuy, size, aggressivePx: px, reduceOnly: false
//   });

//   if (result?.status !== 'ok' && looksLikeInsufficientMargin(result)) {
//     console.warn('[HL DEBUG] margin reject — retrying with fallback size', FALLBACK_SIZE);
//     size = Math.max(FALLBACK_SIZE, MIN_ORDER_SIZE);
//     result = await placeOrder({
//       sdk, coin, isBuy: sideBuy, size, aggressivePx: px, reduceOnly: false
//     });
//   }

//   if (result?.status !== 'ok') {
//     const msg = typeof result?.response === 'string' ? result.response : JSON.stringify(result);
//     throw new Error(`HL rejected order: ${msg}`);
//   }

//   return {
//     result,
//     address,
//     size,
//     leverage: base.leverage,
//     notional: size * price,
//     priceTarget: price,
//     side: sideBuy ? 'LONG' : 'SHORT'
//   };
// }

// async function closeAll(telegramId) {
//   const { sk, address } = await getUserSecretAndAddress(telegramId);
//   const sdk = mkSdk(sk, address);

//   const st = await fetch('https://api.hyperliquid.xyz/info', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'clearinghouseState', user: address })
//   }).then(r => r.json());

//   const pos = Array.isArray(st?.assetPositions) ? st.assetPositions : [];
//   let n = 0; const results = [];
//   for (const p of pos) {
//     if (!p?.position) continue;
//     const coinSym = p.position.coin + '-PERP';
//     const size = Math.abs(parseFloat(p.position.szi));
//     if (size <= 0) continue;
//     const isLong = parseFloat(p.position.szi) > 0;
//     const px = await quoteAggressivePx(p.position.coin, isLong ? 'sell' : 'buy');
//     const r = await placeOrder({
//       sdk, coin: coinSym, isBuy: !isLong, size, aggressivePx: px, reduceOnly: true
//     });
//     results.push({ coin: coinSym, closed: size, tx: r }); n++;
//   }
//   return { closed: n, results };
// }

// module.exports = { openFromSignal, closeAll };

// packages/lib/hlTrade.js
// Build HL SDK per-user, compute size from risk, place/close orders.
// Now tries hlAddress first, then hlMainAddress if needed.

const { users } = require('./db');
const { roflDecrypt } = require('../../bot/roflClient');
const { Wallet } = require('ethers');
const { Hyperliquid } = require('hyperliquid');
const fetch = require('node-fetch');
const { getRisk, useDefault } = require('./risk');

/* ------------------------- user + address helpers ------------------------- */

async function getUserSecretsAndAddrs(telegramId) {
  const col = await users();
  const u = await col.findOne({ telegramId: String(telegramId) });
  if (!u || !u.hlSecretCipher) throw new Error('Connect HL first.');

  const { iv, tag, ciphertext } = u.hlSecretCipher;
  const out = await roflDecrypt(String(telegramId), iv, tag, ciphertext);
  const sk = String(out.plaintext || '').trim();
  if (!sk) throw new Error('HL secret decrypt failed.');

  // Addresses saved in Mongo by your Connect flow
  const apiAddr  = u.hlAddress || null;
  const mainAddr = u.hlMainAddress || null;
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

function roundLot(size, lot = 0.00001, min = 0.0001) {
  const lots = Math.max(Math.floor(size / lot), Math.ceil(min / lot));
  return lots * lot;
}

function computeSize(price, risk, availableUSDC, confidence = 85) {
  const capital = availableUSDC * (risk.capitalUsagePercent || 0.3);
  let lev = risk.minLeverage || 5;
  if (confidence >= 95) lev = risk.maxLeverage || 25;
  else if (confidence >= 90) lev = Math.round((risk.maxLeverage || 25) * 0.8);
  else if (confidence >= 85) lev = Math.round((risk.maxLeverage || 25) * 0.6);
  const notional = capital * lev;
  const sz = notional / price;
  return { size: roundLot(sz), leverage: lev, notional, capital };
}

function mkSdk(sk, addr) {
  return new Hyperliquid({ privateKey: sk, walletAddress: addr, testnet: false });
}

async function placeOrder({ sdk, coin, isBuy, size, aggressivePx, reduceOnly = false }) {
  const params = {
    coin,
    is_buy: isBuy,
    sz: Number(size),
    limit_px: Math.round(aggressivePx),
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: !!reduceOnly
  };
  const r = await sdk.exchange.placeOrder(params);
  return r;
}

async function quoteAggressivePx(coin, side) {
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'l2Book', coin, nSigFigs: 5 })
  });
  const j = await r.json();
  if (side === 'buy'  && j?.levels?.[0]?.[0]) return parseFloat(j.levels[0][0].px) * 1.01;
  if (side === 'sell' && j?.levels?.[1]?.[0]) return parseFloat(j.levels[1][0].px) * 0.99;
  const mids = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' })
  }).then(x => x.json());
  const mid = mids['BTC'];
  return side === 'buy' ? mid * 1.02 : mid * 0.98;
}

/* ------------------------------ Trading ---------------------------------- */

async function tryPlaceWithAddress({ sk, address, slot, risk }) {
  // 1) margin check for this address
  const bal = await getAvailableUSDC(address);
  if (bal.available < 10) {
    return { ok: false, reason: 'INSUFFICIENT_MARGIN', detail: { address, bal } };
  }

  // 2) sizing
  const coin = 'BTC-PERP';
  const price = Number(slot.forecast_price);
  const conf = (slot.confidence_90 && slot.confidence_90[1]) || 85;
  const { size, leverage, notional } = computeSize(price, risk, bal.available, conf);

  // 3) side
  const sideBuy  = slot.signal === 'LONG';
  const sideSell = slot.signal === 'SHORT';
  if (!sideBuy && !sideSell) return { ok: true, skipped: true, reason: 'HOLD' };

  // 4) place aggressively
  const sdk = mkSdk(sk, address);
  const px = await quoteAggressivePx('BTC', sideBuy ? 'buy' : 'sell');

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
        result, address, size, leverage, notional, priceTarget: price,
        side: sideBuy ? 'LONG' : 'SHORT', used: address
      }
    };
  }

  // Common HL error if addr/key mismatch: "User or API Wallet ... does not exist."
  return { ok: false, reason: 'HL_ERROR', detail: { address, result } };
}

async function openFromSignal(telegramId, slot) {
  const { sk, apiAddr, mainAddr } = await getUserSecretsAndAddrs(telegramId);
  const risk = await ensureRisk(telegramId);

  // Respect order: API wallet first, then Main as fallback
  const addressesToTry = [];
  if (apiAddr)  addressesToTry.push({ which: 'API',  addr: apiAddr });
  if (mainAddr) addressesToTry.push({ which: 'MAIN', addr: mainAddr });

  const errors = [];
  for (const entry of addressesToTry) {
    const r = await tryPlaceWithAddress({ sk, address: entry.addr, slot, risk });
    if (r.ok && r.skipped) return { skipped: true, reason: 'HOLD' };
    if (r.ok && !r.skipped) {
      // annotate which wallet we used
      r.exec.wallet = entry.which;
      return r.exec;
    }
    errors.push({ wallet: entry.which, reason: r.reason, detail: r.detail });
  }

  // If we got here, neither address worked
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
  if (mainAddr && mainAddr.toLowerCase() !== apiAddr?.toLowerCase()) {
    outs.push(await closeFor(mainAddr));
  }
  return outs;
}

module.exports = { openFromSignal, closeAll };

