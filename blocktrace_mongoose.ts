// ============================================================
// BlockTrace — Mongoose Schemas (MongoDB)
// 4 collections: blockchain_events, ipfs_metadata_cache,
//                iot_logs, audit_trail
// ============================================================

import mongoose, { Schema, Document } from "mongoose";

// ─── 1. BLOCKCHAIN EVENTS ────────────────────────────────────
// Index events emit từ smart contract.
// Backend listener ghi sau mỗi: BatchMinted, StatusUpdated,
//   IssueReported, IssueResolved, OwnershipTransferred
// Dùng để tái dựng timeline mà không cần query chain lại.
export interface IBlockchainEvent extends Document {
  tokenId: number;
  batchId: string;          // UUID từ PostgreSQL (denormalized)
  eventName: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  from: string;             // wallet address
  to?: string;              // wallet address (nếu transfer)
  payload: Record<string, unknown>; // raw event args từ contract
  indexedAt: Date;
  chainId: number;
}

const BlockchainEventSchema = new Schema<IBlockchainEvent>(
  {
    tokenId:     { type: Number, required: true },
    batchId:     { type: String, required: true },
    eventName:   {
      type: String, required: true,
      enum: ["BatchMinted", "StatusUpdated", "OwnershipTransferred",
             "IssueReported", "IssueResolved", "BatchRecalled"],
    },
    txHash:      { type: String, required: true },
    blockNumber: { type: Number, required: true },
    logIndex:    { type: Number, required: true },
    from:        { type: String, required: true },
    to:          { type: String },
    payload:     { type: Schema.Types.Mixed, required: true },
    indexedAt:   { type: Date, default: Date.now },
    chainId:     { type: Number, default: 11155111 }, // Sepolia
  },
  { collection: "blockchain_events" }
);

// Indexes
BlockchainEventSchema.index({ tokenId: 1 });
BlockchainEventSchema.index({ batchId: 1 });
BlockchainEventSchema.index({ txHash: 1 }, { unique: true });
BlockchainEventSchema.index({ eventName: 1, indexedAt: -1 });
BlockchainEventSchema.index({ blockNumber: -1 });

export const BlockchainEvent = mongoose.model<IBlockchainEvent>(
  "BlockchainEvent",
  BlockchainEventSchema
);


// ─── 2. IPFS METADATA CACHE ──────────────────────────────────
// Cache metadata JSON tải từ IPFS.
// Phase 6 flowchart: Consumer → Fetch Metadata from IPFS
//   → Recalculate Hash → Compare với on-chain hash
// App đọc từ đây thay vì fetch IPFS mỗi lần → giảm latency.
export interface IIpfsMetadataCache extends Document {
  cid: string;
  tokenId: number;
  metadata: {
    productName: string;
    origin: string;
    harvestDate: string;
    certification?: string;
    batchNumber: string;
    [key: string]: unknown;
  };
  computedHash: string;     // SHA-256 recomputed khi cache — dùng để verify integrity
  fetchedAt: Date;
  expiresAt: Date;          // TTL: tự expire sau 7 ngày
}

const IpfsMetadataCacheSchema = new Schema<IIpfsMetadataCache>(
  {
    cid:          { type: String, required: true, unique: true },
    tokenId:      { type: Number, required: true },
    metadata: {
      productName:   { type: String, required: true },
      origin:        { type: String, required: true },
      harvestDate:   { type: String, required: true },
      certification: { type: String },
      batchNumber:   { type: String, required: true },
    },
    computedHash: { type: String, required: true },
    fetchedAt:    { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { collection: "ipfs_metadata_cache" }
);

// TTL index: MongoDB tự xóa document sau khi expiresAt qua
IpfsMetadataCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
IpfsMetadataCacheSchema.index({ tokenId: 1 });

export const IpfsMetadataCache = mongoose.model<IIpfsMetadataCache>(
  "IpfsMetadataCache",
  IpfsMetadataCacheSchema
);


// ─── 3. IOT LOGS ─────────────────────────────────────────────
// Dữ liệu cảm biến raw từ IoT devices theo thời gian thực.
// Dùng trong Phase 4: phát hiện TEMPERATURE_VIOLATION, anomaly.
// Volume lớn → TTL 90 ngày, không JOIN.
export type SensorType = "temperature" | "humidity" | "gps" | "shock" | "light";

export interface IIotLog extends Document {
  batchId: string;
  tokenId: number;
  deviceId: string;
  sensorType: SensorType;
  value: number | { lat: number; lng: number };
  unit: string;
  isAnomaly: boolean;
  threshold?: { min?: number; max?: number };
  recordedAt: Date;
  receivedAt: Date;
}

const IotLogSchema = new Schema<IIotLog>(
  {
    batchId:    { type: String, required: true },
    tokenId:    { type: Number, required: true },
    deviceId:   { type: String, required: true },
    sensorType: {
      type: String, required: true,
      enum: ["temperature", "humidity", "gps", "shock", "light"],
    },
    value:      { type: Schema.Types.Mixed, required: true },
    // Number cho temperature/humidity/shock
    // { lat, lng } cho GPS
    unit:       { type: String, required: true },
    // "°C" | "%" | "g-force" | "lux"
    isAnomaly:  { type: Boolean, default: false },
    threshold: {
      min: { type: Number },
      max: { type: Number },
    },
    recordedAt: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { collection: "iot_logs" }
);

// Indexes
IotLogSchema.index({ batchId: 1, recordedAt: -1 });
IotLogSchema.index({ isAnomaly: 1 });
IotLogSchema.index({ tokenId: 1 });
// TTL: tự xóa sau 90 ngày
IotLogSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const IotLog = mongoose.model<IIotLog>("IotLog", IotLogSchema);


// ─── 4. AUDIT TRAIL ──────────────────────────────────────────
// Ghi lại mọi hành động của actors trên app (off-chain).
// Dùng cho AUDITOR_ROLE, DEFAULT_ADMIN_ROLE, compliance review.
// Append-only — không update, không delete.
export type AuditAction =
  | "CREATE_BATCH"
  | "UPDATE_STATUS"
  | "TRANSFER_OWNERSHIP"
  | "REPORT_ISSUE"
  | "UPLOAD_EVIDENCE"
  | "PROPOSE_RESOLUTION"
  | "RESOLVE_ISSUE"
  | "GRANT_ROLE"
  | "REVOKE_ROLE"
  | "VERIFY_BATCH"
  | "CREATE_ORDER"
  | "RELEASE_FUND"
  | "PAUSE_CONTRACT"
  | "UNPAUSE_CONTRACT";

export interface IAuditTrail extends Document {
  actorId: string;
  actorWallet: string;
  actorRole: string;
  action: AuditAction;
  resourceType: "batch" | "issue" | "order" | "resolution" | "user" | "contract";
  resourceId: string;
  payload?: Record<string, unknown>; // request data (PII đã sanitize)
  txHash?: string;                   // nếu action tạo on-chain tx
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditTrailSchema = new Schema<IAuditTrail>(
  {
    actorId:      { type: String, required: true },
    actorWallet:  { type: String, required: true },
    actorRole:    { type: String, required: true },
    action: {
      type: String, required: true,
      enum: [
        "CREATE_BATCH", "UPDATE_STATUS", "TRANSFER_OWNERSHIP",
        "REPORT_ISSUE", "UPLOAD_EVIDENCE", "PROPOSE_RESOLUTION",
        "RESOLVE_ISSUE", "GRANT_ROLE", "REVOKE_ROLE", "VERIFY_BATCH",
        "CREATE_ORDER", "RELEASE_FUND", "PAUSE_CONTRACT", "UNPAUSE_CONTRACT",
      ],
    },
    resourceType: {
      type: String, required: true,
      enum: ["batch", "issue", "order", "resolution", "user", "contract"],
    },
    resourceId:   { type: String, required: true },
    payload:      { type: Schema.Types.Mixed },
    txHash:       { type: String },
    ipAddress:    { type: String },
    userAgent:    { type: String },
    timestamp:    { type: Date, default: Date.now },
  },
  {
    collection: "audit_trail",
    // Không cho phép update/delete qua Mongoose hooks
    strict: true,
  }
);

// Indexes
AuditTrailSchema.index({ actorId: 1, timestamp: -1 });
AuditTrailSchema.index({ resourceId: 1 });
AuditTrailSchema.index({ action: 1, timestamp: -1 });
AuditTrailSchema.index({ txHash: 1 }, { sparse: true });

export const AuditTrail = mongoose.model<IAuditTrail>(
  "AuditTrail",
  AuditTrailSchema
);
