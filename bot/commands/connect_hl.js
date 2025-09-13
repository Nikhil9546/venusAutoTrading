// // bot/commands/connect_hl.js
// const { users } = require('../../packages/lib/db');
// const { roflEncrypt } = require('../roflClient');

// function isHexAddr(x) { return typeof x === 'string' && x.startsWith('0x') && x.length === 42; }
// function redact(s, show = 4) {
//   if (!s) return '';
//   return s.length <= show * 2 ? '••••' : s.slice(0, show) + '…' + s.slice(-show);
// }

// async function prompt(ctx) {
//   const telegramId = String(ctx.from.id);
//   const col = await users();
//   const u = await col.findOne({ telegramId });
//   if (!u) return ctx.reply('Please press "🧭 Onboard / Start" first.');

//   ctx.session ??= {};
//   ctx.session.await = 'hl_main_addr';
//   await ctx.reply(
//     '🔗 *Step 1/3 — Main Wallet*\n' +
//     'Paste your *Hyperliquid main wallet address* (starts with `0x`).',
//     { parse_mode: 'Markdown' }
//   );
// }

// async function handleText(ctx) {
//   // Not our flow? Don't consume.
//   if (!ctx.session || !ctx.session.await) return false;

//   const telegramId = String(ctx.from.id);
//   const text = (ctx.message?.text || '').trim();
//   const col = await users();

//   try {
//     if (ctx.session.await === 'hl_main_addr') {
//       if (!isHexAddr(text)) {
//         await ctx.reply('❌ Invalid `0x` address. Please paste your *main wallet address* again.');
//         return true; // consumed (we replied)
//       }
//       await col.updateOne({ telegramId }, { $set: { hlMainAddress: text } }, { upsert: true });
//       ctx.session.await = 'hl_user_addr';
//       await ctx.reply(
//         '🔗 *Step 2/3 — API Wallet*\n' +
//         'Paste your *Hyperliquid API wallet address* (starts with `0x`).',
//         { parse_mode: 'Markdown' }
//       );
//       return true;
//     }

//     if (ctx.session.await === 'hl_user_addr') {
//       if (!isHexAddr(text)) {
//         await ctx.reply('❌ Invalid `0x` address. Please paste your *API wallet address* again.');
//         return true;
//       }
//       await col.updateOne({ telegramId }, { $set: { hlAddress: text } }, { upsert: true });
//       ctx.session.await = 'hl_secret';
//       await ctx.reply(
//         '🔐 *Step 3/3 — HL API Private Key*\n' +
//         'Paste your *Hyperliquid API private key*. It will be *encrypted with ROFL*.\n' +
//         'After I confirm, please delete your message.',
//         { parse_mode: 'Markdown' }
//       );
//       return true;
//     }

//     if (ctx.session.await === 'hl_secret') {
//       if (!text || text.length < 8) {
//         await ctx.reply('❌ That does not look like a valid secret. Please paste the *API private key* again.');
//         return true;
//       }
//       const enc = await roflEncrypt(telegramId, text); // { iv, tag, ciphertext }
//       await col.updateOne({ telegramId }, { $set: { hlSecretCipher: enc } }, { upsert: true });

//       ctx.session.hlConnected = true;   // <---- mark success

//       const u = await col.findOne({ telegramId }, { projection: { hlMainAddress: 1, hlAddress: 1 } });
//       await ctx.reply(
//         '✅ *All set!*\n' +
//         `• Main wallet: \`${redact(u?.hlMainAddress)}\`\n` +
//         `• API wallet: \`${redact(u?.hlAddress)}\`\n` +
//         '• API private key: *stored securely (ROFL encrypted)*\n\n' +
//         '_For safety, delete the message that contained your secret._',
//         { parse_mode: 'Markdown' }
//       );
//       ctx.session.await = null;
//       return true;
//     }
//   } catch (e) {
//     console.error('connect_hl handleText error:', e);
//     await ctx.reply('❌ Failed to save. Please try again.');
//     // keep session so user can retry same step
//     return true;
//   }
//   return false;
// }

// module.exports = { prompt, handleText };

// bot/commands/connect_hl.js
const { users } = require('../../packages/lib/db');
const { roflEncrypt } = require('../roflClient');

const STEPS = {
  MAIN_ADDR: 'hl_main_addr',
  API_ADDR: 'hl_api_addr',
  SECRET: 'hl_secret',
};

function isConnectedDoc(u) {
  return Boolean(u?.hlMainAddress && u?.hlAddress && u?.hlSecretCipher);
}

async function isConnected(telegramId) {
  const col = await users();
  const u = await col.findOne({ telegramId: String(telegramId) }, { projection: {
    hlMainAddress: 1, hlAddress: 1, hlSecretCipher: 1
  }});
  return isConnectedDoc(u);
}

async function prompt(ctx) {
  ctx.session ??= {};
  ctx.session.await = STEPS.MAIN_ADDR;

  await ctx.reply(
    '🔗 Let’s connect your Hyperliquid.\n\n' +
    'Step 1/3 — *Paste your Hyperliquid Main Wallet Address* (0x…)\n' +
    '• This is your funding/main wallet on HL.',
    { parse_mode: 'Markdown' }
  );
}

async function handleText(ctx) {
  ctx.session ??= {};
  const step = ctx.session.await;
  if (!step) return false; // not in HL flow

  const col = await users();
  const telegramId = String(ctx.from.id);
  const text = (ctx.message?.text || '').trim();

  try {
    if (step === STEPS.MAIN_ADDR) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
        await ctx.reply('⚠️ That doesn’t look like a wallet address. Please send a valid 0x… address.');
        return true;
      }
      await col.updateOne({ telegramId }, { $set: { hlMainAddress: text } }, { upsert: true });
      ctx.session.await = STEPS.API_ADDR;
      await ctx.reply(
        'Step 2/3 — *Paste your Hyperliquid API Wallet Address* (0x…)\n' +
        '• This is the API wallet used to place trades.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    if (step === STEPS.API_ADDR) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
        await ctx.reply('⚠️ That doesn’t look like a wallet address. Please send a valid 0x… address.');
        return true;
      }
      await col.updateOne({ telegramId }, { $set: { hlAddress: text } }, { upsert: true });
      ctx.session.await = STEPS.SECRET;
      await ctx.reply(
        'Step 3/3 — *Paste your Hyperliquid API Private Key* (will be end-to-end encrypted in ROFL).\n' +
        '• After I confirm, please delete your message for your own hygiene.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    if (step === STEPS.SECRET) {
      if (text.length < 8) {
        await ctx.reply('⚠️ That doesn’t look like a valid secret. Please paste your API private key again.');
        return true;
      }
      const enc = await roflEncrypt(telegramId, text); // { iv, tag, ciphertext }
      await col.updateOne({ telegramId }, { $set: { hlSecretCipher: enc } }, { upsert: true });

      ctx.session.await = null;
      ctx.session.hlConnected = true; // <-- flag for index.js

      await ctx.reply(
        '✅ Your Hyperliquid account is securely connected. ' +
        'You can now adjust risk, trade manually, or enable auto trade.\n\n' +
        'For safety, delete your previous message containing the secret.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
  } catch (e) {
    console.error('connect_hl handleText error:', e);
    await ctx.reply('❌ Something went wrong while saving your details. Please try again.');
    // keep the same step so user can retry
    return true;
  }

  return false;
}

module.exports = { prompt, handleText, isConnected };

