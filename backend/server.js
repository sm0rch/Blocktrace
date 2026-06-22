// server.js
// BlockTrace Backend - Integrated with Blockchain & IPFS
// Run with: npm install && node server.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 4000;
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

const upload = multer({ storage: multer.memoryStorage() });

// Helper to generate QR URL that points to scan endpoint
function getQrUrl(tokenId, req) {
  if (!tokenId) return null;
  // Use BASE_URL if set, or derive from request origin
  const origin = process.env.BASE_URL || (req && req.get('origin')) || baseUrl;
  return `${origin}/scan/${tokenId}`;
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dbService = require('./services/database');
const blockchainService = require('./services/blockchain');

// Optional blockchain routes. Keep the local demo server bootable even when
// the full ./src/routes implementation is not present in this folder.
const apiRoutesPath = path.join(__dirname, 'src', 'routes');
if (fs.existsSync(apiRoutesPath) || fs.existsSync(`${apiRoutesPath}.js`)) {
  const apiRoutes = require('./src/routes');
  app.use('/api', apiRoutes);
} else {
  console.warn('Optional ./src/routes not found; using demo API routes from server.js only.');
}

const frontendDist = path.join(__dirname, 'dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// ───────────────────────────────────────────────────────
// NEW: Blockchain API Routes
// ───────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'BlockTrace API is running',
    availableRoutes: [
      '/api/dashboard/metrics',
      '/api/dashboard/recent-batches',
      '/api/dashboard/alerts',
      '/api/batches',
      '/api/batches (POST)',
      '/api/batches/notifications',
      '/api/batches/notifications/:id',
      '/api/traceability',
      '/api/traceability/:tokenId',
      '/api/scan/:tokenId',
      '/api/scan/report-issue',
      '/api/scan/upload-evidence',
      '/api/payments/escrow/balance',
      '/api/payments/escrow/transactions',
      '/api/escrow/disputes'
    ]
  });
});

// Serve frontend build when available
if (fs.existsSync(frontendDist)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ───────────────────────────────────────────────────────
// Database-backed demo data
// ───────────────────────────────────────────────────────

const databaseFile = path.join(__dirname, 'data', 'BlockTrace_Virtual_DB.json');
const traceabilityFile = path.join(__dirname, 'data', 'traceability_data_updated.json');
let database = {};
let traceabilityData = [];

function loadDatabase() {
  try {
    database = JSON.parse(fs.readFileSync(databaseFile, 'utf8'));
  } catch (error) {
    console.warn(`Unable to load database file ${databaseFile}: ${error.message}`);
    database = {};
  }
}

function loadTraceabilityData() {
  try {
    traceabilityData = JSON.parse(fs.readFileSync(traceabilityFile, 'utf8'));
  } catch (error) {
    console.warn(`Unable to load traceability file ${traceabilityFile}: ${error.message}`);
    traceabilityData = [];
  }
}

loadDatabase();
loadTraceabilityData();

function persistDatabase() {
  if (dbService.getType && dbService.getType() !== 'file') {
    return;
  }

  try {
    fs.writeFileSync(databaseFile, JSON.stringify(database, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to persist database: ${error.message}`);
  }
}

function rebuildInMemoryIndexes() {
  batches = database.batches || [];
  producers = database.producers || [];
  transactions = database.transactions || [];
  issues = database.issues || [];
  qrCodes = database.qr_codes || [];
  carriers = database.carriers || [];
  customers = database.customers || [];
  billings = database.billings || [];
  users = database.users || [];
  certificates = database.certificates || [];
  notifications = database.notifications || [];

  producersById = new Map(producers.map(item => [item.producer_id, item]));
  batchByToken = new Map(batches.map(item => [item.tokenId, item]));
  qrByToken = new Map(qrCodes.map(item => [item.tokenId, item]));
  carriersById = new Map(carriers.map(item => [item.carrier_id, item]));
  customersById = new Map(customers.map(item => [item.customer_id, item]));
  usersById = new Map(users.map(item => [item.user_id, item]));
  certificatesById = new Map(certificates.map(item => [item.cert_id, item]));
}

function generateBatchTokenId() {
  return `BATCH_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

let batches = database.batches || [];
let producers = database.producers || [];
let transactions = database.transactions || [];
let issues = database.issues || [];
let qrCodes = database.qr_codes || [];
let carriers = database.carriers || [];
let customers = database.customers || [];
let billings = database.billings || [];
let users = database.users || [];
let certificates = database.certificates || [];

let producersById = new Map(producers.map(item => [item.producer_id, item]));
let batchByToken = new Map(batches.map(item => [item.tokenId, item]));
let qrByToken = new Map(qrCodes.map(item => [item.tokenId, item]));
let carriersById = new Map(carriers.map(item => [item.carrier_id, item]));
let customersById = new Map(customers.map(item => [item.customer_id, item]));
let usersById = new Map(users.map(item => [item.user_id, item]));
let certificatesById = new Map(certificates.map(item => [item.cert_id, item]));

function batchStatus(batch) {
  // Ư u tiên status đã được lưu từ custody log
  const KNOWN_STATUSES = ['minted', 'transit', 'checkpoint', 'delivering', 'delivered', 'issue', 'pending'];
  if (batch.status && KNOWN_STATUSES.includes(batch.status)) {
    return batch.status;
  }
  // Fallback: tính theo transaction nếu chưa có status rõ ràng
  if (issues.some(issue => issue.tokenId === batch.tokenId && issue.issue_status !== 'Resolved')) {
    return 'issue';
  }
  const tx = transactions.find(item => item.tokenId === batch.tokenId);
  if (!tx) return batch.status || 'pending';
  if (tx.escrow_status === 'Pending') return 'transit';
  return 'delivered';
}

function normalizeFoodCategory(value) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('cà phê') || lower.includes('coffee')) return 'coffee';
  if (lower.includes('lúa') || lower.includes('gạo') || lower.includes('rice')) return 'rice';
  if (lower.includes('sầu riêng') || lower.includes('thanh long') || lower.includes('fruit')) return 'fruit';
  if (lower.includes('rau') || lower.includes('cải') || lower.includes('củ') || lower.includes('vegetable')) return 'vegetable';
  if (lower.includes('sữa') || lower.includes('phô mai') || lower.includes('dairy')) return 'dairy';
  if (lower.includes('thịt') || lower.includes('bò') || lower.includes('gà') || lower.includes('pork') || lower.includes('meat')) return 'meat';
  return 'other';
}

function computeExpiryDate(category, baseDate) {
  const daysMap = {
    coffee: 365,
    rice: 180,
    fruit: 30,
    vegetable: 14,
    dairy: 14,
    meat: 10,
    other: 60,
  };
  const expiryDays = daysMap[category] || daysMap.other;
  const date = new Date(baseDate || new Date().toISOString().slice(0, 10));
  date.setDate(date.getDate() + expiryDays);
  return date.toISOString().slice(0, 10);
}

function batchType(productName, explicitType) {
  if (explicitType) {
    return normalizeFoodCategory(explicitType);
  }
  return normalizeFoodCategory(productName);
}

function formatBatchList(batch) {
  const producer = producersById.get(batch.producer_id) || {};
  const tx = transactions.find(item => item.tokenId === batch.tokenId);
  const customer = tx ? customersById.get(tx.customer_id) : null;

  return {
    id: batch.tokenId,
    batchCode: batch.tokenId,
    productName: batch.productName,
    farmName: batch.producerName || producer.company_name || producer.origin_location || 'Unknown',
    exportDate: batch.harvestDate || batch.created_at || 'Unknown',
    expiryDate: batch.expiryDate || computeExpiryDate(batchType(batch.productName), batch.harvestDate || batch.created_at),
    status: batchStatus(batch),
    hash: batch.blockchain_tx_hash,
    quantity: batch.quantity || 'N/A',
    origin: batch.origin || producer.origin_location || 'Unknown',
    destination: batch.destination || customer?.company_name || 'Unknown',
    qrUrl: qrByToken.get(batch.tokenId)?.url || getQrUrl(batch.tokenId),
    type: batch.type || batchType(batch.productName),
    createdAt: batch.created_at || batch.harvestDate || 'Unknown',
    // Thêm custodyLogs để modal hiển thị đúng tiến trình
    custodyLogs: batch.custodyLogs || [],
  };
}

// ───────────────────────────────────────────────────────
// Auto-Backup Configuration
// ───────────────────────────────────────────────────────
const autoBackupConfig = {
  enabled: process.env.AUTO_BACKUP_ENABLED === 'true' || false,
  intervalMinutes: parseInt(process.env.AUTO_BACKUP_INTERVAL_MINUTES || '60'),
  backupDir: path.join(__dirname, 'backups'),
};

let autoBackupLogs = [];
let autoBackupInterval = null;

function ensureBackupDir() {
  if (!fs.existsSync(autoBackupConfig.backupDir)) {
    fs.mkdirSync(autoBackupConfig.backupDir, { recursive: true });
  }
}

async function performAutoBackup() {
  try {
    ensureBackupDir();
    const backupData = dbService.getAdminBackup ? await dbService.getAdminBackup() : (database || {});
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(autoBackupConfig.backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      filename,
      filepath,
      batchCount: Array.isArray(backupData.batches) ? backupData.batches.length : 0,
      status: 'success',
    };
    
    autoBackupLogs.unshift(logEntry);
    if (autoBackupLogs.length > 50) autoBackupLogs.pop();
    
    console.log(`Auto-backup completed: ${filename}`);
  } catch (error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      status: 'failed',
      error: error.message,
    };
    autoBackupLogs.unshift(logEntry);
    if (autoBackupLogs.length > 50) autoBackupLogs.pop();
    
    console.error(`Auto-backup failed: ${error.message}`);
  }
}

function startAutoBackup() {
  if (!autoBackupConfig.enabled) return;
  
  console.log(`Auto-backup enabled. Interval: ${autoBackupConfig.intervalMinutes} minutes`);
  performAutoBackup();
  
  autoBackupInterval = setInterval(performAutoBackup, autoBackupConfig.intervalMinutes * 60 * 1000);
}

function stopAutoBackup() {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
}

async function getAdminStatus() {
  const backupData = dbService.getAdminBackup ? await dbService.getAdminBackup() : (database || {});
  const lastBackupLog = autoBackupLogs[0];
  
  return {
    storageType: dbService.getType ? dbService.getType() : 'file',
    batchCount: Array.isArray(backupData.batches) ? backupData.batches.length : 0,
    qrCount: Array.isArray(backupData.qr_codes) ? backupData.qr_codes.length : 0,
    userCount: Array.isArray(backupData.users) ? backupData.users.length : 0,
    lastBackup: backupData.exportedAt || null,
    autoBackup: {
      enabled: autoBackupConfig.enabled,
      intervalMinutes: autoBackupConfig.intervalMinutes,
      lastBackupLog: lastBackupLog || null,
    },
  };
}

async function restoreAdminBackup(payload) {
  if (dbService.restoreDatabase) {
    await dbService.restoreDatabase(payload);
  }

  database = payload || {};
  rebuildInMemoryIndexes();
  persistDatabase();
}

function computeDashboardMetrics() {
  return {
    totalBatches: batches.length,
    inTransit: transactions.filter(item => item.escrow_status === 'Pending').length,
    issueCount: issues.filter(issue => issue.issue_status !== 'Resolved').length,
    escrowValue: transactions.reduce((sum, item) => sum + Number(item.escrow_amount || 0), 0),
    currency: 'VND',
  };
}

function computeRecentBatches() {
  return batches
    .slice()
    .sort((a, b) => new Date(b.created_at || b.harvestDate) - new Date(a.created_at || a.harvestDate))
    .slice(0, 5)
    .map(formatBatchList);
}
function fixMojibake(value) {
  if (typeof value !== 'string' || !/[\u00c2\u00c3\u00c4\u00c6\u00e1]/.test(value)) return value;
  const cp1252CodeToByte = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e,
    0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  };
  const bytes = [];
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code <= 0xff) bytes.push(code);
    else if (cp1252CodeToByte[code] !== undefined) bytes.push(cp1252CodeToByte[code]);
    else return value;
  }
  try { return Buffer.from(bytes).toString('utf8'); }
  catch { return value; }
}

function cleanTextFields(item, fields) {
  const next = { ...item };
  for (const field of fields) next[field] = fixMojibake(next[field]);
  return next;
}
function computeDashboardAlerts() {
  // Lấy 5 sự cố mới nhất (đảo ngược mảng)
  return [...issues]
    .reverse()
    .slice(0, 5)
    .map(issue => ({
      id: issue.issue_id,
      tokenId: issue.tokenId,
      title: `Lô hàng ${issue.tokenId} có sự cố!`,
      message: issue.description || `Sự cố loại: ${issue.issue_type} - Trạng thái: ${issue.issue_status}`,
      reported_at: issue.reported_at || issue.created_at || new Date().toISOString(),
    }));
}

let notifications = database.notifications || [];

function addNotification(type, title, message) {
  notifications.unshift({
    id: 'n_' + Date.now() + Math.floor(Math.random() * 1000),
    type,
    title,
    message,
    created_at: new Date().toISOString()
  });
  if (notifications.length > 50) notifications = notifications.slice(0, 50);
  database.notifications = notifications;
  persistDatabase();
}

function computeEscrowBalance() {
  const total = transactions.reduce((sum, item) => sum + Number(item.escrow_amount || 0), 0);
  const locked = transactions.filter(item => item.escrow_status === 'Pending')
    .reduce((sum, item) => sum + Number(item.escrow_amount || 0), 0);
  const available = transactions.filter(item => item.escrow_status !== 'Pending')
    .reduce((sum, item) => sum + Number(item.escrow_amount || 0), 0);
  return {
    total,
    locked,
    available,
    currency: 'VND',
  };
}

function getEscrowTransactions() {
  return transactions.map(item => ({
    id: item.tx_id,
    date: item.created_at,
    txHash: item.tx_id,
    batchCode: item.tokenId,
    type: item.escrow_status === 'Pending' ? 'Deposit' : 'Release',
    amount: item.escrow_amount,
    currency: 'VND',
    status: item.escrow_status.toLowerCase(),
  }));
}

const disputes = issues.map(issue => ({
  id: issue.issue_id,
  batchCode: issue.tokenId,
  status: issue.issue_status.toLowerCase(),
  description: `Sự cố ${issue.issue_type} được báo vào ${issue.reported_at}.`, 
  txHash: issue.tx_id || null,
}));

app.get('/api/dashboard/metrics', (req, res) => res.json(computeDashboardMetrics()));
app.get('/api/dashboard/recent-batches', (req, res) => res.json(computeRecentBatches()));
app.get('/api/dashboard/alerts', (req, res) => res.json(computeDashboardAlerts().map(item => cleanTextFields(item, ['title', 'message']))));

// ──────────────────────────────────────────────────────
// Certificates API
// ──────────────────────────────────────────────────────
function generateCertificateId() {
  return `CERT_${Date.now()}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

app.get('/api/certificates', (req, res) => {
  const { search = '' } = req.query;
  const filtered = certificates.filter(cert => {
    if (!search) return true;
    return [cert.name, cert.issuer, cert.cert_type]
      .some(field => String(field || '').toLowerCase().includes(search.toLowerCase()));
  });
  res.json(filtered);
});

app.post('/api/certificates', (req, res) => {
  const { name, issuer, cert_type, expiry_date, description } = req.body || {};
  if (!name || !issuer) {
    return res.status(400).json({ message: 'name and issuer are required' });
  }
  
  const cert = {
    cert_id: generateCertificateId(),
    name,
    issuer,
    cert_type: cert_type || 'General',
    expiry_date: expiry_date || null,
    description: description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  certificates.push(cert);
  database.certificates = certificates;
  certificatesById.set(cert.cert_id, cert);
  persistDatabase();
  
  res.status(201).json({ success: true, data: cert });
});

app.put('/api/certificates/:certId', (req, res) => {
  const { name, issuer, cert_type, expiry_date, description } = req.body || {};
  const cert = certificatesById.get(req.params.certId);
  
  if (!cert) {
    return res.status(404).json({ message: 'Certificate not found' });
  }
  
  if (name) cert.name = name;
  if (issuer) cert.issuer = issuer;
  if (cert_type) cert.cert_type = cert_type;
  if (expiry_date !== undefined) cert.expiry_date = expiry_date;
  if (description !== undefined) cert.description = description;
  cert.updated_at = new Date().toISOString();
  
  persistDatabase();
  res.json({ success: true, data: cert });
});

app.delete('/api/certificates/:certId', (req, res) => {
  const idx = certificates.findIndex(c => c.cert_id === req.params.certId);
  if (idx === -1) {
    return res.status(404).json({ message: 'Certificate not found' });
  }
  
  const deleted = certificates.splice(idx, 1)[0];
  database.certificates = certificates;
  certificatesById.delete(req.params.certId);
  persistDatabase();
  
  res.json({ success: true, data: deleted });
});

app.get('/api/traceability', (req, res) => {
  const { search = '', scenario = '', integrity = '' } = req.query;
  const filtered = traceabilityData.filter(item => {
    const matchesSearch = search
      ? [item.tokenId, item.productName, item.producer, item.carrier, item.customer]
          .some(field => String(field || '').toLowerCase().includes(search.toLowerCase()))
      : true;
    const matchesScenario = scenario ? item.scenario === scenario : true;
    const matchesIntegrity = integrity
      ? String(item.integrity_check) === String(integrity)
      : true;
    return matchesSearch && matchesScenario && matchesIntegrity;
  });
  res.json(filtered);
});

app.get('/api/traceability/:tokenId', (req, res) => {
  const item = traceabilityData.find(row => String(row.tokenId) === String(req.params.tokenId));
  if (!item) return res.status(404).json({ message: 'Traceability token not found' });
  res.json(item);
});

app.get('/api/admin/status', async (req, res) => {
  try {
    const status = await getAdminStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/backup', async (req, res) => {
  try {
    const backupData = dbService.getAdminBackup ? await dbService.getAdminBackup() : database;
    const payload = JSON.stringify(backupData, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="blocktrace-backup.json"');
    res.send(payload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/restore', upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'Backup JSON file is required' });
  }

  try {
    const payload = JSON.parse(req.file.buffer.toString('utf8'));
    await restoreAdminBackup(payload);
    const status = await getAdminStatus();
    res.json({ success: true, message: 'Restore completed', data: status });
  } catch (error) {
    res.status(400).json({ success: false, message: `Restore failed: ${error.message}` });
  }
});

app.get('/api/admin/auto-backup/config', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: autoBackupConfig.enabled,
      intervalMinutes: autoBackupConfig.intervalMinutes,
    },
  });
});

app.post('/api/admin/auto-backup/config', (req, res) => {
  const { enabled, intervalMinutes } = req.body || {};
  
  if (typeof enabled !== 'undefined') {
    autoBackupConfig.enabled = enabled;
    if (enabled) {
      startAutoBackup();
    } else {
      stopAutoBackup();
    }
  }
  
  if (typeof intervalMinutes !== 'undefined' && intervalMinutes > 0) {
    autoBackupConfig.intervalMinutes = intervalMinutes;
    if (autoBackupConfig.enabled) {
      stopAutoBackup();
      startAutoBackup();
    }
  }
  
  res.json({
    success: true,
    message: 'Auto-backup config updated',
    data: {
      enabled: autoBackupConfig.enabled,
      intervalMinutes: autoBackupConfig.intervalMinutes,
    },
  });
});

app.get('/api/admin/auto-backup/logs', (req, res) => {
  res.json({
    success: true,
    data: autoBackupLogs,
  });
});

app.post('/api/admin/auto-backup/now', async (req, res) => {
  try {
    await performAutoBackup();
    const lastLog = autoBackupLogs[0] || null;
    res.json({
      success: true,
      message: 'Manual backup triggered',
      data: lastLog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Manual backup failed: ${error.message}`,
    });
  }
});

app.post('/api/batches', async (req, res) => {
  const { productName, quantity, origin, destination, carrier, producerId, producerName, type, expiryDate, certificateIds, senderName, senderContact, preciseOrigin } = req.body || {};
  if (!productName || !quantity) {
    return res.status(400).json({ message: 'productName and quantity are required' });
  }

  const tokenId = generateBatchTokenId();
  const producer = producerId ? producersById.get(producerId) : null;
  const now = new Date().toISOString();
  const category = batchType(productName, type);
  const harvestDate = now.slice(0, 10);
  const effectiveExpiry = expiryDate || computeExpiryDate(category, harvestDate);

  const batch = {
    tokenId,
    batchCode: tokenId,
    productName,
    producer_id: producerId || null,
    producerName: producer?.company_name || producerName || 'Unknown',
    quantity,
    origin: preciseOrigin || origin || producer?.origin_location || 'Unknown',
    destination: destination || 'Unknown',
    carrier: carrier || null,
    certificate_ids: Array.isArray(certificateIds) ? certificateIds : [],
    sender_name: senderName || null,
    sender_contact: senderContact || null,
    harvestDate,
    expiryDate: effectiveExpiry,
    type: category,
    created_at: now,
    updated_at: now,
    transaction_time: null,
    status: 'pending',
    blockchain_tx_hash: null,
    onchain_batch_id: null,
    etherscan_url: null,
    metadata_ipfs_cid: null,
  };
  batch.metadata_hash = crypto.createHash('sha256').update(
    JSON.stringify({
      tokenId: batch.tokenId,
      productName: batch.productName,
      quantity: batch.quantity,
      origin: batch.origin,
      destination: batch.destination,
      carrier: batch.carrier,
      producerName: batch.producerName,
      harvestDate: batch.harvestDate,
      expiryDate: batch.expiryDate,
      type: batch.type,
      created_at: batch.created_at,
      status: batch.status,
    })
  ).digest('hex');

  batches.push(batch);
  database.batches = batches;
  batchByToken.set(tokenId, batch);

  const qrText = tokenId;
  const qrUrl = getQrUrl(tokenId, req);
  const qrDataUrl = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'H', type: 'image/png', width: 320 });

  const qrEntry = {
    tokenId,
    url: qrUrl,
    createdAt: new Date().toISOString(),
  };
  qrCodes.push(qrEntry);
  database.qr_codes = qrCodes;
  qrByToken.set(tokenId, qrEntry);

  await dbService.saveBatch(batch);
  await dbService.saveQrCode(qrEntry);
  
  addNotification('info', 'Lô hàng mới được tạo', `Mã lô: ${batch.tokenId} - Sản phẩm: ${productName}`);

  if (blockchainService.isBlockchainEnabled && blockchainService.isBlockchainEnabled()) {
    const result = await blockchainService.recordBatchOnChain(batch);
    if (result.success) {
      batch.blockchain_tx_hash = result.txHash;
      batch.onchain_batch_id = result.onchainBatchId;
      batch.etherscan_url = result.etherscanUrl;
      await dbService.saveBatch(batch);
    } else {
      console.warn('Blockchain record failed:', result.message);
    }
  }

  persistDatabase();

  res.status(201).json({ success: true, data: { ...batch, qrText, qrUrl, qrDataUrl } });
});

app.post('/api/batches/import', upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'File upload is required' });
  }

  const filename = req.file.originalname || '';
  const extension = path.extname(filename).toLowerCase();
  let rows = [];

  try {
    if (extension === '.csv') {
      const csvText = req.file.buffer.toString('utf8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (parsed.errors.length) {
        throw new Error(parsed.errors[0].message);
      }
      rows = parsed.data;
    } else if (extension === '.xlsx' || extension === '.xls') {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      return res.status(400).json({ message: 'Unsupported file type. Use CSV or Excel.' });
    }
  } catch (error) {
    return res.status(400).json({ message: `Unable to parse file: ${error.message}` });
  }

  const imported = [];
  const failed = [];
  const storageType = dbService.getType ? dbService.getType() : 'file';

  for (const [index, rawRow] of rows.entries()) {
    const row = Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [key.trim(), typeof value === 'string' ? value.trim() : value]));
    const errors = [];
    if (!row.productName) errors.push('productName');
    if (!row.quantity) errors.push('quantity');
    if (!row.origin) errors.push('origin');
    if (!row.destination) errors.push('destination');

    if (errors.length) {
      failed.push({ row: index + 1, errors, raw: row });
      continue;
    }

    const tokenId = generateBatchTokenId();
    const now = new Date().toISOString();
    const category = batchType(row.productName, row.type || row.category || row.foodCategory);
    const harvestDate = now.slice(0, 10);
    const effectiveExpiry = row.expiryDate || computeExpiryDate(category, harvestDate);
    const batch = {
      tokenId,
      batchCode: tokenId,
      productName: row.productName,
      producer_id: null,
      producerName: row.producerName || row.producer || 'Unknown',
      quantity: row.quantity,
      origin: row.origin,
      destination: row.destination,
      carrier: row.carrier || 'Unknown',
      harvestDate,
      expiryDate: effectiveExpiry,
      type: category,
      created_at: now,
      updated_at: now,
      transaction_time: null,
      status: 'pending',
      blockchain_tx_hash: null,
      metadata_ipfs_cid: null,
    };
    batch.metadata_hash = crypto.createHash('sha256').update(
      JSON.stringify({
        tokenId: batch.tokenId,
        productName: batch.productName,
        quantity: batch.quantity,
        origin: batch.origin,
        destination: batch.destination,
        carrier: batch.carrier,
        producerName: batch.producerName,
        harvestDate: batch.harvestDate,
        expiryDate: batch.expiryDate,
        type: batch.type,
        created_at: batch.created_at,
        status: batch.status,
      })
    ).digest('hex');

    const qrText = tokenId;
    const qrUrl = getQrUrl(tokenId, req);
    const qrDataUrl = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'H', type: 'image/png', width: 320 });

    const qrEntry = {
      tokenId,
      url: qrUrl,
      createdAt: new Date().toISOString(),
    };

    try {
      batches.push(batch);
      database.batches = batches;
      batchByToken.set(tokenId, batch);
      qrCodes.push(qrEntry);
      database.qr_codes = qrCodes;
      qrByToken.set(tokenId, qrEntry);
      await dbService.saveBatch(batch);
      await dbService.saveQrCode(qrEntry);
      imported.push({ ...batch, qrUrl, qrDataUrl });
    } catch (error) {
      failed.push({ row: index + 1, errors: ['save_failed'], message: error.message });
    }
  }

  persistDatabase();

  res.json({
    success: true,
    importedCount: imported.length,
    failedCount: failed.length,
    failures: failed.slice(0, 10),
    storageType,
    imported,
  });
});

app.get('/api/batches', (req, res) => {
  const { search = '', type = '', status = '', fromDate = '', toDate = '', qr = '' } = req.query;
  const filtered = batches
    .map(formatBatchList)
    .filter(batch => {
      const matchesSearch = [batch.batchCode, batch.productName, batch.farmName]
        .some(field => String(field).toLowerCase().includes(search.toLowerCase()));
      const matchesType = type ? batch.type === type : true;
      const matchesStatus = status ? batch.status === status : true;
      const matchesQr = qr
        ? [batch.batchCode, batch.hash, batch.qrUrl]
            .some(field => String(field || '').toLowerCase().includes(qr.toLowerCase()))
        : true;
      const batchDate = new Date(batch.createdAt || batch.exportDate || '');
      const fromValid = fromDate ? !isNaN(new Date(fromDate)) : true;
      const toValid = toDate ? !isNaN(new Date(toDate)) : true;
      const matchesFrom = fromDate ? batchDate >= new Date(fromDate) : true;
      const matchesTo = toDate ? batchDate <= new Date(toDate) : true;
      return matchesSearch && matchesType && matchesStatus && matchesQr && matchesFrom && matchesTo;
    });
  res.json(filtered);
});

// ── QR Image endpoint — sinh ảnh QR từ localhost, có cache ──
app.get('/api/qr/:tokenId', async (req, res) => {
  const { tokenId } = req.params;
  try {
    const qrBuffer = await QRCode.toBuffer(tokenId, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 ngày
    res.send(qrBuffer);
  } catch (err) {
    res.status(500).json({ message: 'QR generation failed', error: err.message });
  }
});

app.get('/api/batches/notifications', (req, res) => res.json(notifications.map(item => cleanTextFields(item, ['title', 'message']))));
app.delete('/api/batches/notifications/:id', (req, res) => {
  const id = req.params.id;
  const index = notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    notifications.splice(index, 1);
    return res.json({ success: true });
  }
  res.status(404).json({ success: false, message: 'Notification not found' });
});

app.post('/api/batches/:id/custody-log', async (req, res) => {
  const batchId = req.params.id;
  const { status, evidenceHash, imageUrl, note, timestamp } = req.body || {};
  
  const targetBatch = batchByToken.get(batchId);
  if (!targetBatch) {
    return res.status(404).json({ message: `Batch ${batchId} not found` });
  }

  const now = timestamp || new Date().toISOString();
  let txResult = null;
  const transferResults = [];
  
  if (status) {
    // Gọi Blockchain để cập nhật Custody
    if (blockchainService.isBlockchainEnabled() && targetBatch.onchain_batch_id != null) {
      const normalizedStatus = String(status).toLowerCase();
      const transferAttempts = normalizedStatus === 'delivered'
        ? 2
        : (normalizedStatus === 'transit' || normalizedStatus === 'in_transit' ? 1 : 0);

      for (let i = 0; i < transferAttempts; i += 1) {
        const transferResult = await blockchainService.transferCustodyOnChain(targetBatch.onchain_batch_id);
        transferResults.push(transferResult);
        if (!transferResult.success) {
          console.warn('Blockchain transfer custody skipped/failed:', transferResult.message);
          break;
        }
      }

      txResult = await blockchainService.updateCustodyOnChain(targetBatch.onchain_batch_id, evidenceHash, note || status);
      if (txResult.success) {
        targetBatch.blockchain_tx_hash = txResult.txHash; // Cập nhật txHash mới nhất
        targetBatch.etherscan_url = txResult.etherscanUrl;
      } else {
        // Ghi log lỗi, có thể trả về lỗi nếu bắt buộc on-chain
        console.error("Blockchain update failed:", txResult.message);
      }
    } else if (blockchainService.isBlockchainEnabled()) {
      console.warn(`Skipping on-chain custody update for ${batchId}: missing onchain_batch_id`);
    }

    // Lưu lại evidenceHash để phục vụ Traceability
    if (evidenceHash) {
      targetBatch.metadata_ipfs_cid = evidenceHash;
    }
    
    // Khởi tạo custodyLogs nếu chưa có
    if (!targetBatch.custodyLogs) {
      targetBatch.custodyLogs = [];
    }
    targetBatch.custodyLogs.push({
      status,
      evidenceHash,
      imageUrl,
      note,
      timestamp: now,
      txHash: txResult?.txHash || null,
      etherscanUrl: txResult?.etherscanUrl || null,
      transferTxHashes: transferResults.filter(item => item?.success).map(item => item.txHash),
    });
    
    // Ghi nhận sự kiện chuyển trạng thái
    targetBatch.status = status;
    targetBatch.updated_at = now;

    // Lưu xuống file ngay — tránh mất dữ liệu khi reload/restart
    database.batches = batches;
    
    addNotification('success', 'Cập nhật chuỗi cung ứng', `Lô hàng ${batchId} được cập nhật sang trạng thái: ${status}`);
    
    await dbService.saveBatch(targetBatch).catch(console.warn);
    persistDatabase();
  }

  res.json({ 
    success: true, 
    message: 'Custody log updated successfully', 
    data: targetBatch,
    txHash: txResult?.txHash,
    etherscanUrl: txResult?.etherscanUrl,
    transferTxHashes: transferResults.filter(item => item?.success).map(item => item.txHash),
    transferEtherscanUrls: transferResults.filter(item => item?.success).map(item => item.etherscanUrl)
  });
});

app.get('/api/payments/escrow/balance', (req, res) => res.json(computeEscrowBalance()));
app.get('/api/payments/escrow/transactions', (req, res) => res.json(getEscrowTransactions()));

app.post('/api/payments/lock', (req, res) => {
  const { batchId, payeeWallet, amountWei, flatFeeWei } = req.body || {};
  if (!batchId || !payeeWallet || amountWei == null || flatFeeWei == null) {
    return res.status(400).json({ message: 'batchId, payeeWallet, amountWei and flatFeeWei are required' });
  }

  const targetBatch = batchByToken.get(batchId);
  if (!targetBatch) {
    return res.status(404).json({ message: `Batch ${batchId} not found` });
  }

  const now = new Date().toISOString();
  const transaction = {
    tx_id: `LOCK_${Date.now()}`,
    created_at: now,
    tokenId: batchId,
    escrow_amount: Number(amountWei),
    flat_fee: Number(flatFeeWei),
    payee_wallet: payeeWallet,
    escrow_status: 'Pending',
  };
  transactions.push(transaction);

  if (targetBatch) {
    targetBatch.status = 'transit';
    targetBatch.updated_at = now;
    targetBatch.transaction_time = now;
    dbService.saveBatch(targetBatch).catch(console.warn);
  }

  res.json({ success: true, data: transaction });
});

app.post('/api/payments/:batchId/release', (req, res) => {
  const batchId = req.params.batchId;
  const pendingTx = transactions.find(item => item.tokenId === batchId && item.escrow_status === 'Pending');
  if (!pendingTx) {
    return res.status(404).json({ message: `No pending escrow transaction found for ${batchId}` });
  }

  const now = new Date().toISOString();
  pendingTx.escrow_status = 'Released';
  pendingTx.created_at = now;
  pendingTx.tx_id = `RELEASE_${Date.now()}`;

  const targetBatch = batchByToken.get(batchId);
  if (targetBatch) {
    targetBatch.status = 'delivered';
    targetBatch.updated_at = now;
    targetBatch.transaction_time = now;
    dbService.saveBatch(targetBatch).catch(console.warn);
  }

  res.json({ success: true, data: pendingTx });
});

app.get('/api/escrow/disputes', (req, res) => res.json(disputes));
app.post('/api/escrow/disputes', (req, res) => {
  const { batchCode, tokenId, description } = req.body || {};
  const dispute = {
    id: `DISPUTE_${Date.now()}`,
    batchCode: batchCode || tokenId || batches[0]?.tokenId || 'UNKNOWN',
    status: 'pending',
    description: description || 'Dispute opened from demo UI.',
    txHash: null,
  };
  disputes.unshift(dispute);
  res.status(201).json({ success: true, dispute });
});

app.get('/api/scan/:tokenId', (req, res) => {
  const tokenId = req.params.tokenId;
  const batch = batchByToken.get(tokenId);
  if (!batch) return res.status(404).json({ message: 'Token not found' });

  const producer = producersById.get(batch.producer_id) || {};
  const tx = transactions.find(item => item.tokenId === tokenId);
  const carrier = tx ? carriersById.get(tx.carrier_id) : null;
  const qr = qrByToken.get(tokenId);

  res.json({
    tokenId: batch.tokenId,
    productName: batch.productName,
    batchCode: batch.tokenId,
    quantity: batch.quantity || 'N/A',
    facility: producer.company_name || batch.producerName || 'N/A',
    origin: batch.origin || producer.origin_location || 'N/A',
    mfgDate: batch.harvestDate || batch.created_at || 'N/A',
    expDate: batch.expDate || 'N/A',
    carrier: carrier?.carrier_name || batch.carrier || 'N/A',
    trackingCode: tx?.tx_id || 'N/A',
    hash: batch.blockchain_tx_hash,
    txHash: batch.blockchain_tx_hash,
    etherscanUrl: batch.etherscan_url || (batch.blockchain_tx_hash ? `https://sepolia.etherscan.io/tx/${batch.blockchain_tx_hash}` : null),
    onchainBatchId: batch.onchain_batch_id ?? null,
    qrUrl: qr?.url || 'N/A',
    producerEmail: producer.email || 'N/A',
    ipfsCID: batch.metadata_ipfs_cid || 'N/A',
    status: batchStatus(batch),
    custodyLogs: batch.custodyLogs || [],
  });
});

app.post('/api/scan/report-issue', async (req, res) => {
  const { tokenId, issueType, description, evidenceHash } = req.body;
  if (!tokenId || !description) {
    return res.status(400).json({ message: 'tokenId and description are required' });
  }
  const report = {
    issue_id: `ISSUE_${Date.now()}`,
    tokenId,
    issue_type: issueType || 'Unknown',
    issue_status: 'Open',
    reported_at: new Date().toISOString(),
    evidence_hash: evidenceHash || null,
    description: description,
  };
  issues.push(report);
  database.issues = issues;
  
  // Đánh dấu trạng thái lô hàng có vấn đề
  const targetBatch = batchByToken.get(tokenId);
  if (targetBatch) {
    targetBatch.status = 'issue';
    targetBatch.updated_at = report.reported_at;
    database.batches = batches;
  }
  let txResult = null;
  if (targetBatch && blockchainService.isBlockchainEnabled() && targetBatch.onchain_batch_id != null) {
    txResult = await blockchainService.reportIssueOnChain(
      targetBatch.onchain_batch_id,
      evidenceHash || `${tokenId}:${issueType || 'issue'}:${report.reported_at}`,
      issueType || 'Unknown'
    );

    if (txResult.success) {
      report.tx_id = txResult.txHash;
      report.etherscan_url = txResult.etherscanUrl;
      report.onchain_issue_id = txResult.onchainIssueId;
      targetBatch.blockchain_tx_hash = txResult.txHash;
      targetBatch.etherscan_url = txResult.etherscanUrl;
      database.batches = batches;
    } else {
      report.blockchain_error = txResult.message;
      console.error('Blockchain report issue failed:', txResult.message);
    }
  } else if (targetBatch && blockchainService.isBlockchainEnabled()) {
    report.blockchain_error = 'Missing onchain_batch_id for issue report';
    console.warn(`Skipping on-chain issue report for ${tokenId}: missing onchain_batch_id`);
  }
  addNotification('error', 'Sự cố mới được báo cáo', `Lô hàng ${tokenId} gặp sự cố: ${issueType || 'Unknown'}`);
  
  persistDatabase();
  console.log('Issue report saved:', report);
  res.json({
    success: true,
    report,
    txHash: txResult?.txHash || null,
    etherscanUrl: txResult?.etherscanUrl || null,
    blockchainError: txResult && !txResult.success ? txResult.message : report.blockchain_error || null,
  });
});

app.post('/api/scan/upload-evidence', upload.single('file'), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'File upload is required' });
  }

  const hash = crypto.createHash('sha256')
    .update(req.file.buffer)
    .digest('hex');

  const ext = req.file.originalname.split('.').pop() || 'png';
  const filename = `${hash.substring(0, 16)}.${ext}`;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  try {
    fs.writeFileSync(filepath, req.file.buffer);
    const imageUrl = `/uploads/${filename}`;
    res.json({ success: true, hash, imageUrl });
  } catch (err) {
    console.error('Lỗi lưu file ảnh:', err);
    res.status(500).json({ message: 'Không thể lưu file' });
  }
});

async function startServer() {
  await dbService.initDatabase();

  if (dbService.getType && dbService.getType() !== 'file') {
    try {
      const dbBatches = await dbService.getBatches();
      if (Array.isArray(dbBatches) && dbBatches.length) {
        database.batches = dbBatches;
        batches = database.batches;
        batchByToken = new Map(batches.map(item => [item.tokenId, item]));
      }
    } catch (error) {
      console.warn('Failed to load batches from configured database:', error.message);
    }
  }

  blockchainService.initBlockchain();
  startAutoBackup();
  console.log(`Database type: ${dbService.getType ? dbService.getType() : 'file'}`);
  console.log(`Blockchain enabled: ${blockchainService.isBlockchainEnabled ? blockchainService.isBlockchainEnabled() : false}`);

  app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});




