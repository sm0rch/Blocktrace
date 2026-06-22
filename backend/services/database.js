const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

const DB_TYPE = process.env.DB_TYPE || 'file';
const DB_FILE = path.join(__dirname, '..', 'data', 'BlockTrace_Virtual_DB.json');

let dbType = DB_TYPE;
let pgPool = null;
let mysqlPool = null;
let mongoClient = null;
let mongoDb = null;
let fileCache = null;

async function initDatabase() {
  dbType = DB_TYPE;
  if (DB_TYPE === 'postgres') {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    await ensurePostgresSchema();
    return { type: 'postgres' };
  }

  if (DB_TYPE === 'mysql') {
    mysqlPool = await mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    });
    await ensureMysqlSchema();
    return { type: 'mysql' };
  }

  if (DB_TYPE === 'mongodb') {
    mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGODB_DB || 'blocktrace');
    return { type: 'mongodb' };
  }

  loadFileDatabase();
  return { type: 'file' };
}

function loadFileDatabase() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    fileCache = JSON.parse(raw);
  } catch (error) {
    fileCache = {};
  }
}

function persistFileDatabase() {
  if (!fileCache) return;
  fs.writeFileSync(DB_FILE, JSON.stringify(fileCache, null, 2), 'utf8');
}

async function ensurePostgresSchema() {
  const createBatches = `
    CREATE TABLE IF NOT EXISTS batches (
      token_id TEXT PRIMARY KEY,
      batch_code TEXT,
      product_name TEXT,
      producer_id TEXT,
      producer_name TEXT,
      quantity TEXT,
      origin TEXT,
      destination TEXT,
      carrier TEXT,
      harvest_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      status TEXT,
      blockchain_tx_hash TEXT,
      metadata_ipfs_cid TEXT,
      metadata_hash TEXT,
      raw_json JSONB
    );
  `;
  const createQrCodes = `
    CREATE TABLE IF NOT EXISTS qr_codes (
      token_id TEXT PRIMARY KEY,
      url TEXT,
      created_at TEXT,
      raw_json JSONB
    );
  `;
  const createUsers = `
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      role TEXT,
      created_at TEXT,
      raw_json JSONB
    );
  `;
  await pgPool.query(createBatches);
  await pgPool.query(createQrCodes);
  await pgPool.query(createUsers);
  await pgPool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS expiry_date TEXT;`);
  await pgPool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TEXT;`);
}

async function ensureMysqlSchema() {
  const createBatches = `
    CREATE TABLE IF NOT EXISTS batches (
      token_id VARCHAR(255) PRIMARY KEY,
      batch_code VARCHAR(255),
      product_name TEXT,
      producer_id VARCHAR(255),
      producer_name TEXT,
      quantity TEXT,
      origin TEXT,
      destination TEXT,
      carrier TEXT,
      harvest_date TEXT,
      expiry_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      status VARCHAR(50),
      blockchain_tx_hash TEXT,
      metadata_ipfs_cid TEXT,
      metadata_hash TEXT,
      raw_json JSON
    );
  `;
  const createQrCodes = `
    CREATE TABLE IF NOT EXISTS qr_codes (
      token_id VARCHAR(255) PRIMARY KEY,
      url TEXT,
      created_at TEXT,
      raw_json JSON
    );
  `;
  const createUsers = `
    CREATE TABLE IF NOT EXISTS users (
      user_id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255),
      full_name VARCHAR(255),
      role VARCHAR(100),
      created_at TEXT,
      raw_json JSON
    );
  `;
  await mysqlPool.execute(createBatches);
  await mysqlPool.execute(createQrCodes);
  await mysqlPool.execute(createUsers);
  await mysqlPool.execute(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS expiry_date TEXT;`);
  await mysqlPool.execute(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TEXT;`);
}

async function getBatches() {
  if (DB_TYPE === 'postgres') {
    const result = await pgPool.query('SELECT raw_json FROM batches');
    return result.rows.map(row => row.raw_json);
  }
  if (DB_TYPE === 'mysql') {
    const [rows] = await mysqlPool.query('SELECT raw_json FROM batches');
    return rows.map(row => JSON.parse(row.raw_json));
  }
  if (DB_TYPE === 'mongodb') {
    return mongoDb.collection('batches').find().toArray();
  }
  return fileCache.batches || [];
}

async function saveBatch(batch) {
  if (DB_TYPE === 'postgres') {
    const query = `
      INSERT INTO batches (token_id, batch_code, product_name, producer_id, producer_name, quantity, origin, destination, carrier, harvest_date, expiry_date, created_at, updated_at, status, blockchain_tx_hash, metadata_ipfs_cid, metadata_hash, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (token_id) DO UPDATE SET
        batch_code = EXCLUDED.batch_code,
        product_name = EXCLUDED.product_name,
        producer_id = EXCLUDED.producer_id,
        producer_name = EXCLUDED.producer_name,
        quantity = EXCLUDED.quantity,
        origin = EXCLUDED.origin,
        destination = EXCLUDED.destination,
        carrier = EXCLUDED.carrier,
        harvest_date = EXCLUDED.harvest_date,
        expiry_date = EXCLUDED.expiry_date,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        status = EXCLUDED.status,
        blockchain_tx_hash = EXCLUDED.blockchain_tx_hash,
        metadata_ipfs_cid = EXCLUDED.metadata_ipfs_cid,
        metadata_hash = EXCLUDED.metadata_hash,
        raw_json = EXCLUDED.raw_json;
    `;
    await pgPool.query(query, [
      batch.tokenId,
      batch.batchCode,
      batch.productName,
      batch.producer_id,
      batch.producerName,
      batch.quantity,
      batch.origin,
      batch.destination,
      batch.carrier,
      batch.harvestDate,
      batch.expiryDate,
      batch.created_at,
      batch.updated_at,
      batch.status,
      batch.blockchain_tx_hash,
      batch.metadata_ipfs_cid,
      batch.metadata_hash,
      batch,
    ]);
    return;
  }
  if (DB_TYPE === 'mysql') {
    const query = `
      INSERT INTO batches (token_id, batch_code, product_name, producer_id, producer_name, quantity, origin, destination, carrier, harvest_date, expiry_date, created_at, updated_at, status, blockchain_tx_hash, metadata_ipfs_cid, metadata_hash, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        batch_code = VALUES(batch_code),
        product_name = VALUES(product_name),
        producer_id = VALUES(producer_id),
        producer_name = VALUES(producer_name),
        quantity = VALUES(quantity),
        origin = VALUES(origin),
        destination = VALUES(destination),
        carrier = VALUES(carrier),
        harvest_date = VALUES(harvest_date),
        expiry_date = VALUES(expiry_date),
        created_at = VALUES(created_at),
        updated_at = VALUES(updated_at),
        status = VALUES(status),
        blockchain_tx_hash = VALUES(blockchain_tx_hash),
        metadata_ipfs_cid = VALUES(metadata_ipfs_cid),
        metadata_hash = VALUES(metadata_hash),
        raw_json = VALUES(raw_json);
    `;
    await mysqlPool.execute(query, [
      batch.tokenId,
      batch.batchCode,
      batch.productName,
      batch.producer_id,
      batch.producerName,
      batch.quantity,
      batch.origin,
      batch.destination,
      batch.carrier,
      batch.harvestDate,
      batch.expiryDate,
      batch.created_at,
      batch.updated_at,
      batch.status,
      batch.blockchain_tx_hash,
      batch.metadata_ipfs_cid,
      batch.metadata_hash,
      JSON.stringify(batch),
    ]);
    return;
  }
  if (DB_TYPE === 'mongodb') {
    await mongoDb.collection('batches').updateOne(
      { tokenId: batch.tokenId },
      { $set: batch },
      { upsert: true }
    );
    return;
  }

  fileCache.batches = fileCache.batches || [];
  const index = fileCache.batches.findIndex(item => item.tokenId === batch.tokenId);
  if (index === -1) {
    fileCache.batches.push(batch);
  } else {
    fileCache.batches[index] = batch;
  }
  persistFileDatabase();
}

async function saveQrCode(qrEntry) {
  if (DB_TYPE === 'postgres') {
    const query = `
      INSERT INTO qr_codes (token_id, url, created_at, raw_json)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (token_id) DO UPDATE SET
        url = EXCLUDED.url,
        created_at = EXCLUDED.created_at,
        raw_json = EXCLUDED.raw_json;
    `;
    await pgPool.query(query, [qrEntry.tokenId, qrEntry.url, qrEntry.createdAt, qrEntry]);
    return;
  }
  if (DB_TYPE === 'mysql') {
    const query = `
      INSERT INTO qr_codes (token_id, url, created_at, raw_json)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        url = VALUES(url),
        created_at = VALUES(created_at),
        raw_json = VALUES(raw_json);
    `;
    await mysqlPool.execute(query, [qrEntry.tokenId, qrEntry.url, qrEntry.createdAt, JSON.stringify(qrEntry)]);
    return;
  }
  if (DB_TYPE === 'mongodb') {
    await mongoDb.collection('qr_codes').updateOne(
      { tokenId: qrEntry.tokenId },
      { $set: qrEntry },
      { upsert: true }
    );
    return;
  }

  fileCache.qr_codes = fileCache.qr_codes || [];
  const index = fileCache.qr_codes.findIndex(item => item.tokenId === qrEntry.tokenId);
  if (index === -1) {
    fileCache.qr_codes.push(qrEntry);
  } else {
    fileCache.qr_codes[index] = qrEntry;
  }
  persistFileDatabase();
}

async function saveUser(user) {
  if (DB_TYPE === 'postgres') {
    const query = `
      INSERT INTO users (user_id, email, full_name, role, created_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        created_at = EXCLUDED.created_at,
        raw_json = EXCLUDED.raw_json;
    `;
    await pgPool.query(query, [user.user_id, user.email, user.full_name, user.role, user.created_at, user]);
    return;
  }
  if (DB_TYPE === 'mysql') {
    const query = `
      INSERT INTO users (user_id, email, full_name, role, created_at, raw_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        full_name = VALUES(full_name),
        role = VALUES(role),
        created_at = VALUES(created_at),
        raw_json = VALUES(raw_json);
    `;
    await mysqlPool.execute(query, [user.user_id, user.email, user.full_name, user.role, user.created_at, JSON.stringify(user)]);
    return;
  }
  if (DB_TYPE === 'mongodb') {
    await mongoDb.collection('users').updateOne(
      { user_id: user.user_id },
      { $set: user },
      { upsert: true }
    );
    return;
  }

  fileCache.users = fileCache.users || [];
  const index = fileCache.users.findIndex(item => item.user_id === user.user_id);
  if (index === -1) {
    fileCache.users.push(user);
  } else {
    fileCache.users[index] = user;
  }
  persistFileDatabase();
}

async function getUsers() {
  if (DB_TYPE === 'postgres') {
    const result = await pgPool.query('SELECT raw_json FROM users');
    return result.rows.map(row => row.raw_json);
  }
  if (DB_TYPE === 'mysql') {
    const [rows] = await mysqlPool.query('SELECT raw_json FROM users');
    return rows.map(row => JSON.parse(row.raw_json));
  }
  if (DB_TYPE === 'mongodb') {
    return mongoDb.collection('users').find().toArray();
  }
  return fileCache.users || [];
}

async function getAdminBackup() {
  if (DB_TYPE === 'file') {
    return fileCache || {};
  }
  const [batches, qr_codes, users] = await Promise.all([
    getBatches(),
    (async () => {
      if (DB_TYPE === 'postgres') {
        const result = await pgPool.query('SELECT raw_json FROM qr_codes');
        return result.rows.map(row => row.raw_json);
      }
      if (DB_TYPE === 'mysql') {
        const [rows] = await mysqlPool.query('SELECT raw_json FROM qr_codes');
        return rows.map(row => JSON.parse(row.raw_json));
      }
      if (DB_TYPE === 'mongodb') {
        return mongoDb.collection('qr_codes').find().toArray();
      }
      return [];
    })(),
    getUsers(),
  ]);
  return {
    type: DB_TYPE,
    exportedAt: new Date().toISOString(),
    batches,
    qr_codes,
    users,
  };
}

async function restoreDatabase(backup) {
  if (DB_TYPE === 'file') {
    fileCache = backup || {};
    persistFileDatabase();
    return;
  }
  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup payload');
  }

  const restoreBatch = async (batch) => {
    if (!batch || !batch.tokenId) return;
    await saveBatch(batch);
  };
  const restoreQr = async (qr) => {
    if (!qr || !qr.tokenId) return;
    await saveQrCode(qr);
  };
  const restoreUser = async (user) => {
    if (!user || !user.user_id) return;
    await saveUser(user);
  };

  if (Array.isArray(backup.batches)) {
    for (const batch of backup.batches) {
      await restoreBatch(batch);
    }
  }
  if (Array.isArray(backup.qr_codes)) {
    for (const qr of backup.qr_codes) {
      await restoreQr(qr);
    }
  }
  if (Array.isArray(backup.users)) {
    for (const user of backup.users) {
      await restoreUser(user);
    }
  }
}

async function closeDatabase() {
  if (pgPool) await pgPool.end();
  if (mysqlPool) await mysqlPool.end();
  if (mongoClient) await mongoClient.close();
}

function getType() {
  return dbType;
}

module.exports = {
  initDatabase,
  getType,
  getBatches,
  saveBatch,
  saveQrCode,
  getAdminBackup,
  restoreDatabase,
  closeDatabase,
};
