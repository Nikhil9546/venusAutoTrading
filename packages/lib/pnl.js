const { fetch } = require('./http');
const { pushTrade } = require('./dayState');
const ONE_HOUR_MS = 60*60*1000;

async function hyperInfo(body) {
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`HL info ${r.status}`);
  return r.json();
}

async function getPositionsWithROE(ctx) {
  const state = await hyperInfo({ type:'clearinghouseState', user: ctx.hlAddress });
  const fills = await hyperInfo({ type:'userFills', user: ctx.hlAddress });
  const mids  = await hyperInfo({ type:'allMids' });
  const positions = state?.assetPositions || [];
  return positions.map(p => {
    const coin = p.position.coin;
    const size = parseFloat(p.position.szi);
    const unrealizedPnl = parseFloat(p.position.unrealizedPnl || '0');
    const positionValue = parseFloat(p.position.positionValue || '0');
    const leverage = parseFloat(p.position.leverage?.value || '1');
    const marginUsed = parseFloat(p.position.marginUsed || '0');
    const currentPrice = mids[coin];
    const cfills = fills.filter(f => f.coin === coin).sort((a,b)=>b.time-a.time);
    const latest = cfills[0];
    const entryPrice = latest ? latest.px : currentPrice;
    const entryTime = latest ? latest.time : Date.now() - 30*60*1000;
    const initialMargin = Math.abs(positionValue) / Math.max(1, leverage);
    const altIM = marginUsed;
    const roe = initialMargin>0 ? (unrealizedPnl/initialMargin)*100 : 0;
    const alternativeROE = altIM>0 ? (unrealizedPnl/altIM)*100 : 0;
    return {
      coin, size, unrealizedPnl, currentPrice, entryPrice, entryTime,
      positionAgeMs: Date.now()-entryTime, isLong: size>0, leverage,
      positionValue, initialMargin, roe, alternativeROE,
      isOlderThanOneHour: (Date.now()-entryTime)>ONE_HOUR_MS
    };
  });
}

async function guaranteedInstantClose(ctx, coin, size, isBuy, reason='AUTO') {
  try {
    const book = await hyperInfo({ type:'l2Book', coin, nSigFigs:5 });
    let px;
    if (isBuy && book?.levels?.[0]?.[0]) px = parseFloat(book.levels[0][0].px) * 1.0002;
    else if (!isBuy && book?.levels?.[1]?.[0]) px = parseFloat(book.levels[1][0].px) * 0.9998;
    else { const mids = await hyperInfo({ type:'allMids' }); const mid = mids[coin]; px = isBuy? mid*1.0005 : mid*0.9995; }

    const res = await ctx.sdk.exchange.placeOrder({
      coin: `${coin}-PERP`, is_buy: isBuy, sz: Math.abs(size),
      limit_px: Math.round(px), order_type: { limit: { tif: 'Ioc' } }, reduce_only: true
    });
    return { success: res?.status==='ok', result: res };
  } catch (e) { return { success:false, error:e.message }; }
}

function reverseSignal(s){ if(s==='LONG') return 'SHORT'; if(s==='SHORT') return 'LONG'; return s; }

function calcSize(ctx, price, availableUSDC, confidence=85) {
  const S = ctx.settings;
  const capital = availableUSDC * S.allocPct;
  let lev = S.minLev;
  if (confidence>=95) lev=S.maxLev; else if (confidence>=90) lev=Math.round(S.maxLev*0.8); else if (confidence>=85) lev=Math.round(S.maxLev*0.6);
  const notional = capital * lev; const size = notional / price;
  return { size: Math.max(size, 0.0001), leverage: lev, notional, capitalUsed: capital };
}

async function getAvailableUSDC(ctx) {
  const st = await hyperInfo({ type:'clearinghouseState', user: ctx.hlAddress });
  const v = parseFloat(st?.marginSummary?.accountValue || '0');
  const w = parseFloat(st?.withdrawable || st?.marginSummary?.accountValue || '0');
  if (v<=0) return { totalUSDC:0, availableMargin:0, noFunds:true };
  return { totalUSDC:v, availableMargin:w };
}

async function monitorAllPositionsPnL(ctx) {
  const S = ctx.settings;
  const positions = await getPositionsWithROE(ctx);
  const out = [];
  for (const p of positions) {
    const { coin, size, unrealizedPnl, isOlderThanOneHour } = p;
    if (unrealizedPnl >= S.maxProfit) {
      await guaranteedInstantClose(ctx, coin, size, size<0, `MAX_${unrealizedPnl.toFixed(2)}`);
      await require('./dayState').pushTrade(ctx.telegramId, { id:`max_${Date.now()}`, pnl:unrealizedPnl, side:'MAX', size:Math.abs(size), avgPrice:p.currentPrice, leverage:p.leverage, timestamp:Date.now() });
      out.push({ coin, action:'MAX_PROFIT' }); continue;
    }
    if (unrealizedPnl >= S.quickProfit) {
      await guaranteedInstantClose(ctx, coin, size, size<0, `QUICK_${unrealizedPnl.toFixed(2)}`);
      await require('./dayState').pushTrade(ctx.telegramId, { id:`quick_${Date.now()}`, pnl:unrealizedPnl, side:'QUICK', size:Math.abs(size), avgPrice:p.currentPrice, leverage:p.leverage, timestamp:Date.now() });
      out.push({ coin, action:'QUICK_PROFIT' }); continue;
    }
    if (!isOlderThanOneHour && unrealizedPnl <= -S.maxLoss) {
      await guaranteedInstantClose(ctx, coin, size, size<0, `STOP_${unrealizedPnl.toFixed(2)}`);
      await require('./dayState').pushTrade(ctx.telegramId, { id:`stop_${Date.now()}`, pnl:unrealizedPnl, side:'STOP', size:Math.abs(size), avgPrice:p.currentPrice, leverage:p.leverage, timestamp:Date.now() });
      out.push({ coin, action:'STOP_LOSS' }); continue;
    }
    out.push({ coin, action:'HOLD' });
  }
  return out;
}

module.exports = { getPositionsWithROE, guaranteedInstantClose, reverseSignal, calcSize, getAvailableUSDC, monitorAllPositionsPnL };
