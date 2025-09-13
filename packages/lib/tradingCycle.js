const fetch = require('node-fetch');
const { getDayState, pushTrade } = require('./dayState');
const { monitorAllPositionsPnL, reverseSignal, calcSize, getAvailableUSDC } = require('./pnl');

async function fetchForecast() {
  const r = await fetch(process.env.FORECAST_API_URL, { headers: { accept:'application/json', 'api-key': process.env.FORECAST_API_KEY }});
  if (!r.ok) throw new Error(`Forecast ${r.status}`);
  const j = await r.json(); const arr = j.forecast_today_hourly||[];
  return arr.length ? arr[arr.length-1] : null;
}

async function runUserTradeCycle(ctx) {
  // 1) Manage open positions
  const mgmt = await monitorAllPositionsPnL(ctx);

  // 2) Daily loss gate
  const ds = await getDayState(ctx.telegramId);
  if (ds.realizedLoss >= ctx.settings.maxDailyLoss) return { message:'Daily loss limit hit', mgmt };

  // 3) Signal
  const slot = await fetchForecast();
  if (!slot || slot.signal==='HOLD' || !slot.forecast_price) return { message:'No trade signal', mgmt };

  // 4) Size
  const bal = await getAvailableUSDC(ctx);
  if (bal.noFunds || bal.availableMargin < 10) return { error:'Insufficient funds', mgmt, bal };
  const s = calcSize(ctx, slot.forecast_price, bal.availableMargin, (slot.confidence_90?.[1])||85);

  // 5) Place order (optionally reverse)
  const sig = ctx.settings.reverseSignal ? reverseSignal(slot.signal) : slot.signal;
  const isBuy = sig === 'LONG';

  // mids + tiny offset for IOC
  const mids = await (await fetch('https://api.hyperliquid.xyz/info', {
    method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ type:'allMids' })
  })).json();
  const mid = mids['BTC'];
  const px = Math.round(isBuy ? mid*1.0005 : mid*0.9995);

  const res = await ctx.sdk.exchange.placeOrder({
    coin:'BTC-PERP', is_buy:isBuy, sz:Number(s.size), limit_px:px,
    order_type:{ limit:{ tif:'Ioc' } }, reduce_only:false
  });

  const ok = res?.status==='ok';
  if (ok) await pushTrade(ctx.telegramId, { id:`new_${Date.now()}`, pnl:0, side:sig, size:Number(s.size), avgPrice:px, leverage:s.leverage, timestamp:Date.now() });

  return { placed: ok, sig, px, size: s.size, leverage: s.leverage, mgmt };
}

module.exports = { runUserTradeCycle };
