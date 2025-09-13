
// function startKeyboard() {
//   return {
//     reply_markup: {
//       keyboard: [
//         [{ text: '🧭 Onboard / Start' }]
//       ],
//       resize_keyboard: true,
//       one_time_keyboard: false,
//     },
//   };
// }

// function afterStartKeyboard() {
//   return {
//     reply_markup: {
//       keyboard: [
//         [{ text: '🔗 Connect your Hyperliquid' }, { text: '🎡 Spin the Wheel' }]
//       ],
//       resize_keyboard: true,
//       one_time_keyboard: false,
//     },
//   };
// }

// function mainTradingKeyboard() {
//   return {
//     reply_markup: {
//       keyboard: [
//         [{ text: '⚙️ Adjust Risk' }, { text: '🚀 Trade Now (Manual)' }],
//         [{ text: '🤖 Auto Trade (Signals)' }, { text: '🛑 Kill All Positions' }],
//         [{ text: '📊 Check Signal' }]
//       ],
//       resize_keyboard: true,
//       one_time_keyboard: false,
//     },
//   };
// }

// module.exports = { startKeyboard, afterStartKeyboard, mainTradingKeyboard };


// bot/keyboard.js

function setupKeyboard() {
  return {
    keyboard: [
      [{ text: '🧭 Onboard / Start' }],
      [{ text: '🔗 Connect HL' }],
      [{ text: '🎰 Spin the Wheel' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function tradingKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Portfolio' }, { text: '⚙️ Adjust Risk' }],
      [{ text: '🚀 Trade Now' }, { text: '🤖 Auto Trade' }],
      [{ text: '🛑 Kill All Positions' }, { text: '🔄 Check Signal' }],
      [{ text: '🎰 Spin the Wheel' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

// thin wrappers to keep ctx.reply terse
function asMarkup(kb) {
  return { reply_markup: kb };
}

module.exports = {
  setupKeyboard,
  tradingKeyboard,
  asMarkup,
};
