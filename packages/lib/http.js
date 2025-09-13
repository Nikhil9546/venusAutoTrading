// packages/lib/http.js
let f = globalThis.fetch;

if (!f) {
  try {
    // node-fetch v2 returns the function; v3 returns { default: fn }
    f = require('node-fetch');
    if (f && f.default) f = f.default;
  } catch {
    // last-resort dynamic import
    f = (...args) => import('node-fetch').then(m => m.default(...args));
  }
}

module.exports = {
  fetch: (...args) => f(...args),
};

