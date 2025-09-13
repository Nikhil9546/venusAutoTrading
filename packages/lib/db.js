const { MongoClient } = require('mongodb');
let client, db;
async function connect() {
  if (db) return db;
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DB || 'test_avax');
  await Promise.all([
    db.collection('users').createIndex({ telegramId: 1 }, { unique: true }),
    db.collection('dayStates').createIndex({ telegramId: 1, day: 1 }, { unique: true })
  ]);
  return db;
}
async function users() { return (await connect()).collection('users'); }
async function dayStates() { return (await connect()).collection('dayStates'); }
module.exports = { connect, users, dayStates };
