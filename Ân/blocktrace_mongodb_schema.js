// ============================================================
// BLOCKTRACE — MongoDB Schema (Off-chain)
// Dựa trên ERD Off-chain v2
// Database: MongoDB + Mongoose ODM
// ============================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

// ============================================================
// NHÓM 1 — ĐỊNH DANH VAI TRÒ
// ============================================================

// ----------------------------------------------------------
// PRODUCER
// ----------------------------------------------------------
const ProducerSchema = new Schema(
  {
    producer_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    company_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    origin_location: {
      type: String,
      trim: true,
    },
    business_license: {
      type: String,
      unique: true,
      sparse: true, // cho phép null nhưng unique khi có giá trị
    },
    tax_code: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Danh sách chứng chỉ: GlobalGAP, VietGAP, v.v.
    // Dùng array thay vì text để dễ query/filter
    certification_list: {
      type: [String],
      default: [],
    },
    // Điểm uy tín tổng hợp — cập nhật sau mỗi Resolution
    reputation_score: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    // Wallet address liên kết On-chain (PRODUCER_ROLE)
    wallet_address: {
      type: String,
      sparse: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "producers",
  }
);

// ----------------------------------------------------------
// CARRIER (Nhà vận chuyển / Distributor)
// ----------------------------------------------------------
const CarrierSchema = new Schema(
  {
    carrier_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    company_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    business_license: {
      type: String,
      unique: true,
      sparse: true,
    },
    tax_code: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Danh sách phương tiện: dùng array object thay vì text
    vehicle_list: [
      {
        plate_number: String,  // biển số
        vehicle_type: String,  // loại xe
        max_load_kg: Number,   // tải trọng (kg)
      },
    ],
    // Chứng chỉ vận chuyển lạnh (cold chain)
    cold_chain_cert: {
      type: String,
      trim: true,
    },
    reputation_score: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    wallet_address: {
      type: String,
      sparse: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "carriers",
  }
);

// ----------------------------------------------------------
// CUSTOMER (Người mua / Consumer / Retailer)
// ----------------------------------------------------------
const CustomerSchema = new Schema(
  {
    customer_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    origin_location: {
      type: String,
      trim: true,
    },
    // Individual | Enterprise
    customer_type: {
      type: String,
      enum: ["Individual", "Enterprise"],
      default: "Individual",
    },
    wallet_address: {
      type: String,
      sparse: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "customers",
  }
);


// ============================================================
// NHÓM 2 — LÔ HÀNG (BATCH)
// ============================================================

// ----------------------------------------------------------
// BATCH_NFT — Trung tâm hệ thống
// ----------------------------------------------------------
const BatchNFTSchema = new Schema(
  {
    // tokenId là khóa chính — dùng để truy vấn nhanh
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    producer_id: {
      type: String,
      required: true,
      ref: "Producer",
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    origin: {
      type: String,
      trim: true,
    },
    harvestDate: {
      type: Date,
    },
    certification: {
      type: String,
      trim: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },

    // --- Mã neo On-chain ---
    // Hash giao dịch mint NFT trên blockchain
    blockchain_tx_hash: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    // Địa chỉ smart contract quản lý lô hàng
    smart_contract_address: {
      type: String,
      trim: true,
    },
    // CID IPFS của metadata — dùng để rehash verify integrity
    metadata_ipfs_cid: {
      type: String,
      trim: true,
    },

    // Trạng thái lô hàng — mirror On-chain status
    current_status: {
      type: String,
      enum: [
        "MINTED",
        "PACKED",
        "HANDED_OVER_TO_CARRIER",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "UNDER_REVIEW",
        "RECALLED",
        "SETTLED",
      ],
      default: "MINTED",
    },

    // Chủ sở hữu hiện tại (mirror On-chain currentOwner)
    current_owner_wallet: {
      type: String,
      trim: true,
    },

    is_recalled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "batch_nfts",
  }
);

// ----------------------------------------------------------
// QR_CODE — 1-1 với BatchNFT
// ----------------------------------------------------------
const QRCodeSchema = new Schema(
  {
    qr_id: {
      type: String,
      required: true,
      unique: true,
    },
    tokenId: {
      type: String,
      required: true,
      unique: true, // 1-1 với batch
      ref: "BatchNFT",
      index: true,
    },
    // VD: https://blocktrace.app/verify/123
    url: {
      type: String,
      required: true,
      trim: true,
    },
    // Base64 hoặc URL ảnh QR lưu trên S3/IPFS
    qr_image_url: {
      type: String,
      trim: true,
    },
    generated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "qr_codes",
  }
);


// ============================================================
// NHÓM 3 — GIAO DỊCH & TÀI CHÍNH (Money Path)
// ============================================================

// ----------------------------------------------------------
// TRANSACTION — Đơn hàng & Escrow
// ----------------------------------------------------------
const TransactionSchema = new Schema(
  {
    tx_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      ref: "BatchNFT",
      index: true,
    },
    carrier_id: {
      type: String,
      ref: "Carrier",
      index: true,
    },
    customer_id: {
      type: String,
      required: true,
      ref: "Customer",
      index: true,
    },

    // --- Escrow State (mirror On-chain) ---
    escrow_status: {
      type: String,
      enum: ["Locked", "Released", "Refunded", "Disputed"],
      default: "Locked",
    },
    escrow_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Thời điểm giải ngân — sau khi xác nhận giao hàng
    payment_released_at: {
      type: Date,
    },
    // Lý do giải ngân: giao hàng thành công / hết thời hạn
    payment_released_reason: {
      type: String,
      trim: true,
    },

    // --- Mã neo On-chain ---
    blockchain_tx_hash: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    smart_contract_address: {
      type: String,
      trim: true,
    },

    // Trạng thái đơn hàng tổng
    order_status: {
      type: String,
      enum: [
        "ORDER_CREATED",
        "PAYMENT_HELD_IN_ESCROW",
        "IN_FULFILLMENT",
        "DELIVERY_CONFIRMED",
        "FUND_RELEASED",
        "ORDER_SETTLED",
        "DISPUTED",
        "REFUNDED",
      ],
      default: "ORDER_CREATED",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "transactions",
  }
);

// ----------------------------------------------------------
// BILLING_DETAIL — Chi tiết tài chính (1-1 với Transaction)
// ----------------------------------------------------------
const BillingDetailSchema = new Schema(
  {
    billing_id: {
      type: String,
      required: true,
      unique: true,
    },
    tx_id: {
      type: String,
      required: true,
      unique: true, // 1-1 với Transaction
      ref: "Transaction",
      index: true,
    },
    flat_fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    logistics_fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Link hóa đơn PDF trên IPFS/S3
    invoice_url: {
      type: String,
      trim: true,
    },
    // Số tiền hoàn — 0 nếu không hoàn
    refund_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Lý do hoàn tiền — đối soát với Resolution
    refund_reason: {
      type: String,
      trim: true,
    },
    // Pending | Paid | Refunded | Disputed
    billing_status: {
      type: String,
      enum: ["Pending", "Paid", "Refunded", "Disputed"],
      default: "Pending",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "billing_details",
  }
);

// ----------------------------------------------------------
// SHIPMENT_LOG — IoT & Logistics Data (append-only)
// ----------------------------------------------------------
const ShipmentLogSchema = new Schema(
  {
    log_id: {
      type: String,
      required: true,
      unique: true,
    },
    tx_id: {
      type: String,
      required: true,
      ref: "Transaction",
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      ref: "BatchNFT",
      index: true,
    },

    // IoT sensor data — lưu dạng array để dễ query theo time range
    temperature_logs: [
      {
        value_celsius: Number,
        recorded_at: Date,
        sensor_id: String,
      },
    ],
    humidity_logs: [
      {
        value_percent: Number,
        recorded_at: Date,
        sensor_id: String,
      },
    ],
    // Chuỗi tọa độ GPS theo thời gian
    gps_tracking: [
      {
        lat: Number,
        lng: Number,
        recorded_at: Date,
      },
    ],
    // Log mở/đóng cửa container
    door_events: [
      {
        event_type: { type: String, enum: ["OPEN", "CLOSE"] },
        recorded_at: Date,
      },
    ],
    // Vận đơn, chứng từ hải quan — lưu URL/CID
    logistics_documents: [
      {
        doc_type: String,   // bill_of_lading | customs | invoice
        url: String,        // IPFS CID hoặc S3 URL
        uploaded_at: Date,
      },
    ],

    logged_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "shipment_logs",
  }
);


// ============================================================
// NHÓM 4 — XỬ LÝ SỰ CỐ (Issue & Resolution)
// ============================================================

// ----------------------------------------------------------
// ISSUE_REPORT — Báo cáo sự cố (append-only)
// ----------------------------------------------------------
const IssueReportSchema = new Schema(
  {
    issue_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      ref: "BatchNFT",
      index: true,
    },
    tx_id: {
      type: String,
      ref: "Transaction",
      index: true,
    },

    // Producer | Carrier | Customer | Inspector
    reporter_type: {
      type: String,
      enum: ["Producer", "Carrier", "Customer", "Inspector"],
      required: true,
    },
    // FK động theo reporter_type
    reporter_id: {
      type: String,
      required: true,
    },

    // Loại sự cố
    issue_type: {
      type: String,
      enum: [
        "Damaged",
        "Spoiled",
        "Missing",
        "Delayed",
        "Temperature_Violation",
        "Batch_Mismatch",
        "Other",
      ],
      required: true,
    },
    issue_description: {
      type: String,
      trim: true,
    },

    // Danh sách CID ảnh/video bằng chứng trên IPFS
    evidence_ipfs_cids: {
      type: [String],
      default: [],
    },
    // Báo cáo kiểm định từ bên thứ ba
    inspection_report_url: {
      type: String,
      trim: true,
    },

    // Open | Under Review | Resolved | Rejected
    issue_status: {
      type: String,
      enum: ["Open", "Under_Review", "Resolved", "Rejected"],
      default: "Open",
    },

    // --- Mã neo On-chain ---
    blockchain_tx_hash: {
      type: String,
      sparse: true,
      trim: true,
    },

    reported_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "issue_reports",
  }
);

// ----------------------------------------------------------
// RESOLUTION — Kết quả xử lý sự cố (1-1 với IssueReport)
// ----------------------------------------------------------
const ResolutionSchema = new Schema(
  {
    resolution_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    issue_id: {
      type: String,
      required: true,
      unique: true, // 1-1 với IssueReport
      ref: "IssueReport",
      index: true,
    },

    // Refund | Replace | Recall | Rejected
    resolution_type: {
      type: String,
      enum: ["Refund", "Replace", "Recall", "Rejected", "Discount"],
      required: true,
    },
    // ID người/bộ phận xử lý (DISPUTE_RESOLVER_ROLE)
    resolved_by: {
      type: String,
      required: true,
    },
    resolution_description: {
      type: String,
      trim: true,
    },
    // Biên bản thỏa thuận PDF trên IPFS
    settlement_doc_url: {
      type: String,
      trim: true,
    },

    // --- Đối soát tài chính ---
    // Refund | Deduct_Carrier | No_Action
    financial_impact: {
      type: String,
      enum: ["Refund", "Deduct_Carrier", "No_Action"],
      default: "No_Action",
    },
    // Số tiền hoàn — phải khớp với BillingDetail.refund_amount
    refund_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // true nếu thu hồi toàn bộ lô hàng
    recall_batch: {
      type: Boolean,
      default: false,
    },

    // --- Mã neo On-chain ---
    blockchain_tx_hash: {
      type: String,
      sparse: true,
      trim: true,
    },

    resolved_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "resolutions",
  }
);


// ============================================================
// NHÓM 5 — TRUY VẤN & UY TÍN
// ============================================================

// ----------------------------------------------------------
// QUERY_HISTORY — Lịch sử truy vấn QR / Verify
// ----------------------------------------------------------
const QueryHistorySchema = new Schema(
  {
    query_id: {
      type: String,
      required: true,
      unique: true,
    },
    tokenId: {
      type: String,
      required: true,
      ref: "BatchNFT",
      index: true,
    },

    // Producer | Carrier | Customer | Anonymous
    queried_by_type: {
      type: String,
      enum: ["Producer", "Carrier", "Customer", "Anonymous"],
      default: "Anonymous",
    },
    // FK động theo queried_by_type — null nếu Anonymous
    queried_by_id: {
      type: String,
      default: null,
    },

    // Hash metadata tại thời điểm truy vấn — dùng rehash verify
    metadata_hash_verified: {
      type: String,
      trim: true,
    },
    // true nếu hash khớp On-chain → dữ liệu toàn vẹn
    integrity_check: {
      type: Boolean,
      default: null, // null = chưa verify
    },

    queried_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "query_histories",
  }
);

// ----------------------------------------------------------
// REPUTATION_LOG — Lịch sử thay đổi điểm uy tín (append-only)
// ----------------------------------------------------------
const ReputationLogSchema = new Schema(
  {
    log_id: {
      type: String,
      required: true,
      unique: true,
    },

    // Producer | Carrier
    subject_type: {
      type: String,
      enum: ["Producer", "Carrier"],
      required: true,
    },
    // FK động: producer_id hoặc carrier_id
    subject_id: {
      type: String,
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      ref: "BatchNFT",
      index: true,
    },
    resolution_id: {
      type: String,
      ref: "Resolution",
    },

    score_before: {
      type: Number,
      required: true,
    },
    score_after: {
      type: Number,
      required: true,
    },
    // Dương = tăng điểm, Âm = giảm điểm
    score_delta: {
      type: Number,
      required: true,
    },
    // Giải thích lý do thay đổi điểm
    reason: {
      type: String,
      trim: true,
    },

    logged_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "reputation_logs",
  }
);


// ============================================================
// COMPOUND INDEXES — Tối ưu query thường gặp
// ============================================================

// BatchNFT: tìm theo producer + status
BatchNFTSchema.index({ producer_id: 1, current_status: 1 });

// Transaction: tìm theo customer + order_status
TransactionSchema.index({ customer_id: 1, order_status: 1 });
// Transaction: tìm theo tokenId + escrow_status
TransactionSchema.index({ tokenId: 1, escrow_status: 1 });

// ShipmentLog: tìm log theo tx + thời gian
ShipmentLogSchema.index({ tx_id: 1, logged_at: -1 });

// IssueReport: tìm issue theo tokenId + status
IssueReportSchema.index({ tokenId: 1, issue_status: 1 });
// IssueReport: tìm issue do reporter báo
IssueReportSchema.index({ reporter_type: 1, reporter_id: 1 });

// ReputationLog: tìm lịch sử điểm theo subject + thời gian
ReputationLogSchema.index({ subject_type: 1, subject_id: 1, logged_at: -1 });

// QueryHistory: tìm lịch sử verify theo tokenId + thời gian
QueryHistorySchema.index({ tokenId: 1, queried_at: -1 });


// ============================================================
// EXPORT MODELS
// ============================================================

const Producer       = mongoose.model("Producer",       ProducerSchema);
const Carrier        = mongoose.model("Carrier",        CarrierSchema);
const Customer       = mongoose.model("Customer",       CustomerSchema);
const BatchNFT       = mongoose.model("BatchNFT",       BatchNFTSchema);
const QRCode         = mongoose.model("QRCode",         QRCodeSchema);
const Transaction    = mongoose.model("Transaction",    TransactionSchema);
const BillingDetail  = mongoose.model("BillingDetail",  BillingDetailSchema);
const ShipmentLog    = mongoose.model("ShipmentLog",    ShipmentLogSchema);
const IssueReport    = mongoose.model("IssueReport",    IssueReportSchema);
const Resolution     = mongoose.model("Resolution",     ResolutionSchema);
const QueryHistory   = mongoose.model("QueryHistory",   QueryHistorySchema);
const ReputationLog  = mongoose.model("ReputationLog",  ReputationLogSchema);

module.exports = {
  Producer,
  Carrier,
  Customer,
  BatchNFT,
  QRCode,
  Transaction,
  BillingDetail,
  ShipmentLog,
  IssueReport,
  Resolution,
  QueryHistory,
  ReputationLog,
};
