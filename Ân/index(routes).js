// ============================================================
// routes/index.js — Tổng hợp toàn bộ API routes BlockTrace
// ============================================================
// Mount vào app.js:
//   const routes = require("./src/routes");
//   app.use("/api", routes);
// ============================================================

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers");

// ─────────────────────────────────────────────────────────────
// BATCH ROUTES
// ─────────────────────────────────────────────────────────────
// POST   /api/batches                          Tạo batch mới (Producer)
// GET    /api/batches/:tokenId                 Lấy chi tiết batch
// POST   /api/batches/:tokenId/transfer        Chuyển custody
// POST   /api/batches/:tokenId/custody-log     Ghi mốc vận chuyển

router.post("/batches",                           ctrl.batch.createBatch);
router.get ("/batches/:tokenId",                  ctrl.batch.getBatch);
router.post("/batches/:tokenId/transfer",         ctrl.batch.transferCustody);
router.post("/batches/:tokenId/custody-log",      ctrl.batch.updateCustody);

// ─────────────────────────────────────────────────────────────
// ISSUE ROUTES
// ─────────────────────────────────────────────────────────────
// POST   /api/issues                           Mở issue mới
// GET    /api/issues/:issueId                  Chi tiết issue
// POST   /api/issues/:issueId/evidence         Neo hash bằng chứng
// POST   /api/issues/:issueId/confirm          Stakeholder xác nhận phương án
// POST   /api/issues/:issueId/resolve          Resolver chốt settlement

router.post("/issues",                            ctrl.issue.reportIssue);
router.get ("/issues/:issueId",                   ctrl.issue.getIssue);
router.post("/issues/:issueId/evidence",          ctrl.issue.anchorEvidence);
router.post("/issues/:issueId/confirm",           ctrl.issue.confirmResolution);
router.post("/issues/:issueId/resolve",           ctrl.issue.resolveIssue);

// ─────────────────────────────────────────────────────────────
// PAYMENT / ESCROW ROUTES
// ─────────────────────────────────────────────────────────────
// POST   /api/payments/lock                    Khóa escrow
// POST   /api/payments/:tokenId/release        Giải ngân
// GET    /api/payments/:tokenId/escrow         Trạng thái escrow

router.post("/payments/lock",                     ctrl.payment.lockPayment);
router.post("/payments/:tokenId/release",         ctrl.payment.releasePayment);
router.get ("/payments/:tokenId/escrow",          ctrl.payment.getEscrow);

module.exports = router;


// ============================================================
// app.js — Entry point mẫu
// ============================================================
/*
require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const routes    = require("./src/routes");

const app = express();
app.use(express.json());

// Routes
app.use("/api", routes);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BlockTrace API running on port ${PORT}`));
*/


// ============================================================
// package.json — dependencies cần cài
// ============================================================
/*
{
  "dependencies": {
    "ethers": "^6.x",
    "express": "^4.x",
    "mongoose": "^8.x",
    "dotenv": "^16.x"
  }
}

npm install ethers express mongoose dotenv
*/


// ============================================================
// API REFERENCE — Tóm tắt toàn bộ endpoints
// ============================================================
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  BATCH                                                          │
// ├────────┬────────────────────────────────┬──────────────────────┤
// │ METHOD │ PATH                           │ ROLE                 │
// ├────────┼────────────────────────────────┼──────────────────────┤
// │ POST   │ /api/batches                   │ PRODUCER             │
// │ GET    │ /api/batches/:tokenId          │ Public               │
// │ POST   │ /api/batches/:tokenId/transfer │ currentOwner         │
// │ POST   │ /api/batches/:tokenId/custody-log │ DISTRIBUTOR/RETAILER│
// ├─────────────────────────────────────────────────────────────────┤
// │  ISSUE                                                          │
// ├────────┬────────────────────────────────┬──────────────────────┤
// │ POST   │ /api/issues                    │ INSPECTOR/DIST/RETAIL│
// │ GET    │ /api/issues/:issueId           │ Public               │
// │ POST   │ /api/issues/:issueId/evidence  │ INSPECTOR/DIST/RETAIL│
// │ POST   │ /api/issues/:issueId/confirm   │ PRODUCER/DIST/RETAIL │
// │ POST   │ /api/issues/:issueId/resolve   │ RESOLVER             │
// ├─────────────────────────────────────────────────────────────────┤
// │  PAYMENT                                                        │
// ├────────┬────────────────────────────────┬──────────────────────┤
// │ POST   │ /api/payments/lock             │ Buyer (Customer)     │
// │ POST   │ /api/payments/:tokenId/release │ Payer/Payee/Resolver │
// │ GET    │ /api/payments/:tokenId/escrow  │ Public               │
// └────────┴────────────────────────────────┴──────────────────────┘
