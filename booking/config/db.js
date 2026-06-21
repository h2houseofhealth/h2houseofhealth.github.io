const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const dbPath = path.join(dataDir, 'booking.db');
const db = new Database(dbPath);

function query(sql, callback) {
  try {
    const statement = db.prepare(sql);
    const normalizedSql = String(sql || '').trim().toUpperCase();
    const results = normalizedSql.startsWith('SELECT') ? statement.all() : statement.run();
    callback(null, results);
  } catch (error) {
    callback(error);
  }
}

module.exports = { query };
