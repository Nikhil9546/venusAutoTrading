// // packages/lib/hl.js
// // Always derive the user wallet from the user's ROFL-encrypted secret.
// // Never use env main/user wallet for portfolio/data fetches.

// // const { users } = require('./db');
// // const { roflDecrypt } = require('../../bot/roflClient');
// // const { Wallet } = require('ethers'); // v5
// // const { fetch } = require('./http');

// // async function deriveAndPersistAddress(telegramId, userDoc) {
// //   if (!userDoc || !userDoc.hlSecretCipher) {
// //     throw new Error('No Hyperliquid secret connected. Tap “Connect HL”.');
// //   }
// //   const { iv, tag, ciphertext } = userDoc.hlSecretCipher || {};
// //   if (!iv || !tag || !ciphertext) {
// //     throw new Error('HL secret record incomplete. Re-connect HL.');
// //   }

// //   const out = await roflDecrypt(String(telegramId), iv, tag, ciphertext); // { plaintext }
// //   const secret = String(out.plaintext || '').trim();
// //   if (!secret) throw new Error('HL secret decrypt failed.');

// //   const wallet = new Wallet(secret);
// //   const address = wallet.address;

// //   // Overwrite any previous value to eliminate old main-wallet cache
// //   const col = await users();
// //   await col.updateOne(
// //     { telegramId: String(telegramId) },
// //     { $set: { hlAddress: address } },
// //     { upsert: true }
// //   );

// //   return address;
// // }

// // async function fetchClearing(hlAddress) {
// //   const res = await fetch('https://api.hyperliquid.xyz/info', {
// //     method: 'POST',
// //     headers: { 'Content-Type': 'application/json' },
// //     body: JSON.stringify({ type: 'clearinghouseState', user: hlAddress })
// //   });
// //   if (!res.ok) throw new Error(`HL API clearinghouseState ${res.status}`);
// //   return res.json();
// // }

// // async function fetchAllMids() {
// //   const res = await fetch('https://api.hyperliquid.xyz/info', {
// //     method: 'POST',
// //     headers: { 'Content-Type': 'application/json' },
// //     body: JSON.stringify({ type: 'allMids' })
// //   });
// //   if (!res.ok) throw new Error(`HL API allMids ${res.status}`);
// //   return res.json();
// // }

// // async function fetchUserFills(hlAddress) {
// //   const res = await fetch('https://api.hyperliquid.xyz/info', {
// //     method: 'POST',
// //     headers: { 'Content-Type': 'application/json' },
// //     body: JSON.stringify({ type: 'userFills', user: hlAddress })
// //   });
// //   if (!res.ok) throw new Error(`HL API userFills ${res.status}`);
// //   return res.json();
// // }

// // function computePositions(state, mids, fills) {
// //   const raw = Array.isArray(state?.assetPositions) ? state.assetPositions : [];
// //   const out = [];
// //   for (const p of raw) {
// //     if (!p?.position) continue;
// //     const coin = p.position.coin;
// //     const size = parseFloat(p.position.szi);
// //     const unrealizedPnl = parseFloat(p.position.unrealizedPnl || '0');
// //     const positionValue = Math.abs(parseFloat(p.position.positionValue || '0'));
// //     const lev = parseFloat(p.position.leverage?.value || '1');
// //     const mid = mids[coin];

// //     const cf = (fills || [])
// //       .filter((f) => f.coin === coin)
// //       .sort((a, b) => (b.time || 0) - (a.time || 0))[0];

// //     const entry = cf
// //       ? parseFloat(cf.px)
// //       : (mid && Math.abs(size) > 0 ? mid - (unrealizedPnl / Math.abs(size)) : mid);

// //     const initialMargin = lev > 0 ? (positionValue / lev) : 0;
// //     const roe = initialMargin > 0 ? (unrealizedPnl / initialMargin) * 100 : 0;

// //     out.push({
// //       coin,
// //       side: size >= 0 ? 'LONG' : 'SHORT',
// //       size: Math.abs(size),
// //       mid,
// //       entry,
// //       pnl: unrealizedPnl,
// //       leverage: lev,
// //       positionValue,
// //       initialMargin,
// //       roe
// //     });
// //   }
// //   return out;
// // }

// // function formatUsd(n) {
// //   return new Intl.NumberFormat('en-US', {
// //     style: 'currency', currency: 'USD', maximumFractionDigits: 2
// //   }).format(n || 0);
// // }

// // function formatReply(hlAddress, state, positions) {
// //   const ms = state?.marginSummary || {};
// //   const acct = parseFloat(ms.accountValue || '0');
// //   const withdrawable = parseFloat((state.withdrawable ?? ms.accountValue) || '0');

// //   let text =
// //     `*Hyperliquid Portfolio*\n` +
// //     `*User Address:* \`${hlAddress}\`\n` +
// //     `*Account Value:* ${formatUsd(acct)}\n` +
// //     `*Withdrawable:* ${formatUsd(withdrawable)}\n\n`;

// //   if (!positions.length) return text + '_No open positions._';

// //   text += `*Open Positions (${positions.length})*\n`;
// //   for (const pos of positions) {
// //     text +=
// //       `• *${pos.coin}* ${pos.side}  size: ${pos.size}\n` +
// //       `  entry: ${pos.entry?.toFixed(2)}  mid: ${pos.mid?.toFixed(2)}\n` +
// //       `  PnL: ${formatUsd(pos.pnl)}  ROE: ${pos.roe.toFixed(2)}%  lev: ${pos.leverage}x\n`;
// //   }
// //   return text;
// // }

// // async function buildPortfolioMessage(telegramId) {
// //   const col = await users();
// //   const userDoc = await col.findOne({ telegramId: String(telegramId) });
// //   if (!userDoc) throw new Error('User not initialized. Tap “Onboard / Start”.');

// //   // Always derive from the user’s secret and overwrite cache
// //   const address = await deriveAndPersistAddress(telegramId, userDoc);

// //   const [state, mids, fills] = await Promise.all([
// //     fetchClearing(address),
// //     fetchAllMids(),
// //     fetchUserFills(address)
// //   ]);

// //   const positions = computePositions(state, mids, fills);
// //   return formatReply(address, state, positions);
// // }

// // module.exports = {
// //   buildPortfolioMessage
// // };

// // packages/lib/hl.js
// // Portfolio fetcher that reads hlAddress & hlMainAddress from Mongo directly.
// // Robust network handling: retries + timeout + host fallback.
// // NOTE: This file uses local node-fetch (not ./http) to avoid global timeouts.

// const { users } = require('./db');
// const fetch = require('node-fetch'); // local use
// const AbortController = global.AbortController || require('abort-controller');

// // HL info endpoints (primary + fallback). You can add more if needed.
// const HL_INFO_HOSTS = [
//   'https://api.hyperliquid.xyz/info',
//   'https://api2.hyperliquid.xyz/info',
// ];

// // Simple in-memory cache for mids to reduce calls.
// let midsCache = { ts: 0, data: null };

// /* --------------------------- helpers: fetch w/ retry --------------------------- */

// async function sleep(ms) {
//   return new Promise((r) => setTimeout(r, ms));
// }

// async function fetchJsonWithRetry(urls, init, {
//   attempts = 3,
//   baseTimeoutMs = 10000,      // 10s per attempt (you can bump to 15000 if your link is slow)
//   backoffMs = 500,            // start backoff
//   backoffFactor = 2,          // exponential
// } = {}) {
//   let lastErr;

//   for (let attempt = 1; attempt <= attempts; attempt++) {
//     // Try each host for this attempt
//     for (const url of urls) {
//       const controller = new AbortController();
//       const t = setTimeout(() => controller.abort(), baseTimeoutMs);
//       try {
//         const res = await fetch(url, { ...init, signal: controller.signal });
//         clearTimeout(t);
//         if (!res.ok) {
//           lastErr = new Error(`HTTP ${res.status} @ ${url}`);
//           continue; // try next host
//         }
//         return res.json();
//       } catch (e) {
//         clearTimeout(t);
//         lastErr = e;
//         // try next host in the same attempt
//       }
//     }

//     // If all hosts failed this attempt, backoff before next attempt
//     if (attempt < attempts) {
//       await sleep(backoffMs);
//       backoffMs *= backoffFactor;
//     }
//   }

//   throw lastErr || new Error('Unknown network error');
// }

// /* --------------------------- HL query functions --------------------------- */

// async function hlClearing(address) {
//   return fetchJsonWithRetry(HL_INFO_HOSTS, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'clearinghouseState', user: address }),
//   });
// }

// async function hlAllMids() {
//   const now = Date.now();
//   if (midsCache.data && now - midsCache.ts < 10_000) {
//     return midsCache.data; // 10s cache
//   }

//   const data = await fetchJsonWithRetry(HL_INFO_HOSTS, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'allMids' }),
//   });

//   midsCache = { ts: now, data };
//   return data;
// }

// async function hlUserFills(address) {
//   return fetchJsonWithRetry(HL_INFO_HOSTS, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ type: 'userFills', user: address }),
//   });
// }

// /* -------------------------- Position processing ------------------------- */

// function computePositions(state, mids, fills) {
//   const raw = Array.isArray(state?.assetPositions) ? state.assetPositions : [];
//   const out = [];

//   for (const p of raw) {
//     if (!p?.position) continue;

//     const coin = p.position.coin;
//     const size = parseFloat(p.position.szi);
//     const pnl  = parseFloat(p.position.unrealizedPnl || '0');
//     const pv   = Math.abs(parseFloat(p.position.positionValue || '0'));
//     const lev  = parseFloat(p.position.leverage?.value || '1');
//     const mid  = mids[coin];

//     // latest fill for entry px if available
//     const lastFill = (fills || [])
//       .filter(f => f.coin === coin)
//       .sort((a, b) => (b.time || 0) - (a.time || 0))[0];

//     const entry = lastFill
//       ? parseFloat(lastFill.px)
//       : (mid && Math.abs(size) > 0 ? mid - (pnl / Math.abs(size)) : mid);

//     const initialMargin = lev > 0 ? (pv / lev) : 0;
//     const roe = initialMargin > 0 ? (pnl / initialMargin) * 100 : 0;

//     out.push({
//       coin,
//       side: size >= 0 ? 'LONG' : 'SHORT',
//       size: Math.abs(size),
//       mid,
//       entry,
//       pnl,
//       leverage: lev,
//       positionValue: pv,
//       initialMargin,
//       roe,
//     });
//   }

//   return out;
// }

// /* ----------------------------- Formatting ------------------------------- */

// function formatUsd(n) {
//   return new Intl.NumberFormat('en-US', {
//     style: 'currency',
//     currency: 'USD',
//     maximumFractionDigits: 2,
//   }).format(n || 0);
// }

// function fmtAddress(a) {
//   if (!a) return '—';
//   return '`' + a.slice(0, 6) + '…' + a.slice(-4) + '`';
// }

// function sectionFromState(title, address, state, positions) {
//   const ms = state?.marginSummary || {};
//   const acct = parseFloat(ms.accountValue || '0');
//   const withdrawable = parseFloat((state.withdrawable ?? ms.accountValue) || '0');

//   let text =
//     `*${title}*\n` +
//     `• Address: ${fmtAddress(address)}\n` +
//     `• Account Value: ${formatUsd(acct)}\n` +
//     `• Withdrawable: ${formatUsd(withdrawable)}\n`;

//   if (!positions.length) return text + '_No open positions._\n';

//   text += `• Open Positions (${positions.length})\n`;
//   for (const pos of positions) {
//     text +=
//       `   • *${pos.coin}* ${pos.side}  size: ${pos.size}\n` +
//       `     entry: ${pos.entry?.toFixed(2)}  mid: ${pos.mid?.toFixed(2)}\n` +
//       `     PnL: ${formatUsd(pos.pnl)}  ROE: ${pos.roe.toFixed(2)}%  lev: ${pos.leverage}x\n`;
//   }
//   return text + '\n';
// }

// /* -------------------------- Public entry point -------------------------- */

// async function buildPortfolioMessage(telegramId) {
//   const col = await users();
//   const userDoc = await col.findOne({ telegramId: String(telegramId) });
//   if (!userDoc) {
//     throw new Error('User not initialized. Tap “Onboard / Start”.');
//   }

//   const apiAddr  = userDoc.hlAddress;      // API wallet (trading)
//   const mainAddr = userDoc.hlMainAddress;  // Main wallet

//   if (!apiAddr && !mainAddr) {
//     throw new Error('No Hyperliquid addresses saved. Tap “Connect HL”.');
//   }

//   const mids = await hlAllMids();
//   let message = '*Hyperliquid Portfolio*\n\n';

//   // API wallet section
//   if (apiAddr) {
//     const [state, fills] = await Promise.all([
//       hlClearing(apiAddr),
//       hlUserFills(apiAddr),
//     ]);
//     const positions = computePositions(state, mids, fills);
//     message += sectionFromState('API Wallet (Trading)', apiAddr, state, positions);
//   }

//   // Main wallet section (skip if same as API)
//   if (mainAddr && mainAddr.toLowerCase() !== (apiAddr || '').toLowerCase()) {
//     const [state, fills] = await Promise.all([
//       hlClearing(mainAddr),
//       hlUserFills(mainAddr),
//     ]);
//     const positions = computePositions(state, mids, fills);
//     message += sectionFromState('Main Wallet', mainAddr, state, positions);
//   }

//   return message.trim();
// }

// module.exports = {
//   buildPortfolioMessage,
// };

// packages/lib/hl.js
// Build Hyperliquid portfolio view with robust number handling & retries.

const { users } = require('./db');
const fetch = require('node-fetch'); // local use
const AbortController = global.AbortController || require('abort-controller');

// HL info endpoints (primary + fallback). You can add more if needed.
const HL_INFO_HOSTS = [
  'https://api.hyperliquid.xyz/info',
  'https://api2.hyperliquid.xyz/info',
];

// Simple in-memory cache for mids to reduce calls.
let midsCache = { ts: 0, data: null };

/* --------------------------- helpers: fetch w/ retry --------------------------- */

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJsonWithRetry(urls, init, {
  attempts = 3,
  baseTimeoutMs = 10000,      // 10s per attempt
  backoffMs = 500,            // start backoff
  backoffFactor = 2,          // exponential
} = {}) {
  let lastErr;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // Try each host for this attempt
    for (const url of urls) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), baseTimeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} @ ${url}`);
          continue; // try next host
        }
        return res.json();
      } catch (e) {
        clearTimeout(t);
        lastErr = e;
        // try next host in the same attempt
      }
    }

    // If all hosts failed this attempt, backoff before next attempt
    if (attempt < attempts) {
      await sleep(backoffMs);
      backoffMs *= backoffFactor;
    }
  }

  throw lastErr || new Error('Unknown network error');
}

/* --------------------------- HL query functions --------------------------- */

async function hlClearing(address) {
  return fetchJsonWithRetry(HL_INFO_HOSTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: address }),
  });
}

async function hlAllMids() {
  const now = Date.now();
  if (midsCache.data && now - midsCache.ts < 10_000) {
    return midsCache.data; // 10s cache
  }

  const data = await fetchJsonWithRetry(HL_INFO_HOSTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });

  midsCache = { ts: now, data };
  return data;
}

async function hlUserFills(address) {
  return fetchJsonWithRetry(HL_INFO_HOSTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'userFills', user: address }),
  });
}

/* ---------------------------- numeric utilities ---------------------------- */

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatUsd(n) {
  const v = toNum(n) ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtPx(n) {
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

function fmtPct(n) {
  return Number.isFinite(n) ? n.toFixed(2) + '%' : '—';
}

/* -------------------------- Position processing ------------------------- */

function computePositions(state, mids, fills) {
  const raw = Array.isArray(state?.assetPositions) ? state.assetPositions : [];
  const out = [];

  for (const p of raw) {
    if (!p?.position) continue;

    const coin = p.position.coin;
    const size = toNum(p.position.szi) ?? 0;
    const pnl  = toNum(p.position.unrealizedPnl) ?? 0;
    const pv   = Math.abs(toNum(p.position.positionValue) ?? 0);
    const lev  = toNum(p.position.leverage?.value) ?? 1;
    const mid  = toNum(mids?.[coin]); // may be null if HL doesn’t return it

    // latest fill for entry px if available
    const lastFill = (fills || [])
      .filter(f => f.coin === coin)
      .sort((a, b) => (b.time || 0) - (a.time || 0))[0];

    const entry = lastFill
      ? toNum(lastFill.px)
      : (Number.isFinite(mid) && Math.abs(size) > 0
          ? mid - (pnl / Math.abs(size))
          : mid); // may stay null

    const initialMargin = lev > 0 ? (pv / lev) : 0;
    const roe = initialMargin > 0 ? (pnl / initialMargin) * 100 : 0;

    out.push({
      coin,
      side: size >= 0 ? 'LONG' : 'SHORT',
      size: Math.abs(size),
      mid,
      entry,
      pnl,
      leverage: lev,
      positionValue: pv,
      initialMargin,
      roe,
    });
  }

  return out;
}

// /* ----------------------------- Formatting ------------------------------- */

// function fmtAddress(a) {
//   if (!a) return '—';
//   return '`' + a.slice(0, 6) + '…' + a.slice(-4) + '`';
// }

// function sectionFromState(title, address, state, positions) {
//   const ms = state?.marginSummary || {};
//   const acct = toNum(ms.accountValue) ?? 0;
//   const withdrawable = toNum(state.withdrawable ?? ms.accountValue) ?? 0;

//   let text =
//     `*${title}*\n` +
//     `• Address: ${fmtAddress(address)}\n` +
//     `• Account Value: ${formatUsd(acct)}\n` +
//     `• Withdrawable: ${formatUsd(withdrawable)}\n`;

//   if (!positions.length) return text + '_No open positions._\n';

//   text += `• Open Positions (${positions.length})\n`;
//   for (const pos of positions) {
//     text +=
//       `   • *${pos.coin}* ${pos.side}  size: ${pos.size}\n` +
//       `     entry: ${fmtPx(pos.entry)}  mid: ${fmtPx(pos.mid)}\n` +
//       `     PnL: ${formatUsd(pos.pnl)}  ROE: ${fmtPct(pos.roe)}  lev: ${pos.leverage}x\n`;
//   }
//   return text + '\n';
// }

/* ----------------------------- Formatting ------------------------------- */

function formatUsd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function fmtAddressInline(a) {
  if (!a) return '`—`';
  return '`' + a.slice(0, 6) + '…' + a.slice(-4) + '`';
}

function fmtNum(n, digits = 2) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(digits) : '—';
}

function formatPositionsTable(positions) {
  if (!positions?.length) return '_No open positions._';

  // header
  let out = '```\n';
  out += [
    pad('COIN', 7),
    pad('SIDE', 6),
    pad('SIZE', 9),
    pad('ENTRY', 12),
    pad('MID', 12),
    pad('PNL', 12),
    pad('ROE', 7),
    pad('LEV', 5),
  ].join(' ') + '\n';
  out += ''.padEnd(71, '─') + '\n';

  for (const p of positions) {
    out += [
      pad(p.coin || '', 7),
      pad(p.side || '', 6),
      pad(fmtNum(p.size, 4), 9),
      pad(fmtNum(p.entry, 2), 12),
      pad(fmtNum(p.mid, 2), 12),
      pad(formatUsd(p.pnl), 12),
      pad((Number.isFinite(p.roe) ? p.roe.toFixed(2) + '%' : '—'), 7),
      pad((Number.isFinite(p.leverage) ? p.leverage + 'x' : '—'), 5),
    ].join(' ') + '\n';
  }

  out += '```';
  return out;
}

function pad(s, w) {
  s = String(s);
  if (s.length >= w) return s.slice(0, w);
  return s + ' '.repeat(w - s.length);
}

function sectionFromState(title, address, state, positions) {
  const ms = state?.marginSummary || {};
  const accountValue  = parseFloat(ms.accountValue || '0');
  const withdrawable  = parseFloat((state.withdrawable ?? ms.accountValue) || '0');

  let text =
    `*${title}*\n` +
    `• Address: ${fmtAddressInline(address)}\n` +
    `• Account Value: ${formatUsd(accountValue)}\n` +
    `• Withdrawable: ${formatUsd(withdrawable)}\n\n` +
    `*Open Positions*\n` +
    `${formatPositionsTable(positions)}\n`;

  return text + '\n';
}


/* -------------------------- Public entry point -------------------------- */

async function buildPortfolioMessage(telegramId) {
  const col = await users();
  const userDoc = await col.findOne({ telegramId: String(telegramId) });
  if (!userDoc) {
    throw new Error('User not initialized. Tap “Onboard / Start”.');
  }

  const apiAddr  = userDoc.hlAddress;      // API wallet (trading)
  const mainAddr = userDoc.hlMainAddress;  // Main wallet

  if (!apiAddr && !mainAddr) {
    throw new Error('No Hyperliquid addresses saved. Tap “Connect HL”.');
  }

  const mids = await hlAllMids();
  let message = '*Hyperliquid Portfolio*\n\n';

  // API wallet section
  if (apiAddr) {
    const [state, fills] = await Promise.all([
      hlClearing(apiAddr),
      hlUserFills(apiAddr),
    ]);
    const positions = computePositions(state, mids, fills);
    message += sectionFromState('API Wallet (Trading)', apiAddr, state, positions);
  }

  // Main wallet section (skip if same as API)
  if (mainAddr && mainAddr.toLowerCase() !== (apiAddr || '').toLowerCase()) {
    const [state, fills] = await Promise.all([
      hlClearing(mainAddr),
      hlUserFills(mainAddr),
    ]);
    const positions = computePositions(state, mids, fills);
    message += sectionFromState('Main Wallet', mainAddr, state, positions);
  }

  return message.trim();
}

module.exports = {
  buildPortfolioMessage,
};


