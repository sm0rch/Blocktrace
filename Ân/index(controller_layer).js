// ============================================================
// controllers/batch.controller.js
// ============================================================
const svc = require("../services/contract.service");

/**
 * POST /api/batches
 * Tạo batch mới — chỉ PRODUCER_ROLE
 * Body: { producerId, productName, origin, harvestDate,
 *         certification, batchNumber, metadataCID,
 *         metadataHashHex, producerWallet }
 */
async function createBatch(req, res) {
  try {
    const result = await svc.createBatch(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/batches/:tokenId
 * Lấy chi tiết batch (on-chain + off-chain)
 * Query: ?queriedById=xxx&queriedByType=Customer
 */
async function getBatch(req, res) {
  try {
    const { tokenId }   = req.params;
    const { queriedById, queriedByType } = req.query;
    const result = await svc.getBatchDetail(tokenId, queriedById, queriedByType);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/batches/:tokenId/transfer-custody
 * Chuyển custody sang distributor/retailer
 * Body: { toWallet, callerWallet }
 */
async function transferCustody(req, res) {
  try {
    const { tokenId } = req.params;
    const result = await svc.transferCustody({ tokenId, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/batches/:tokenId/custody-log
 * Ghi mốc vận chuyển (IoT checkpoint)
 * Body: { txId, updateHashHex, note, iotData, callerWallet }
 */
async function updateCustody(req, res) {
  try {
    const { tokenId } = req.params;
    const result = await svc.updateCustody({ tokenId, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { createBatch, getBatch, transferCustody, updateCustody };


// ============================================================
// controllers/issue.controller.js
// ============================================================

/**
 * POST /api/issues
 * Mở issue và khóa batch → UnderReview
 * Body: { tokenId, issueHashHex, issueType, issueDescription,
 *         reporterId, reporterType, callerWallet }
 */
async function reportIssue(req, res) {
  try {
    const result = await svc.reportIssue(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/issues/:issueId/evidence
 * Neo hash bằng chứng off-chain lên on-chain
 * Body: { evidenceHashHex, evidenceCIDs, callerWallet }
 */
async function anchorEvidence(req, res) {
  try {
    const { issueId } = req.params;
    const result = await svc.anchorEvidence({ issueId, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/issues/:issueId/confirm-resolution
 * Bên liên quan xác nhận phương án xử lý
 * Body: { callerWallet }
 */
async function confirmResolution(req, res) {
  try {
    const { issueId } = req.params;
    const result = await svc.confirmResolution({ issueId, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/issues/:issueId/resolve
 * Resolver chốt settlement — chỉ RESOLVER_ROLE
 * Body: { settlementHashHex, resolutionType, refundAmount,
 *         resolvedById, resolutionDescription,
 *         settlementDocUrl, callerWallet }
 */
async function resolveIssue(req, res) {
  try {
    const { issueId } = req.params;
    const result = await svc.resolveIssue({ issueId, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/issues/:issueId
 * Lấy chi tiết issue (on-chain + off-chain + resolution)
 */
async function getIssue(req, res) {
  try {
    const { issueId } = req.params;
    const result = await svc.getIssueDetail(issueId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const issueController = { reportIssue, anchorEvidence, confirmResolution, resolveIssue, getIssue };


// ============================================================
// controllers/payment.controller.js
// ============================================================

/**
 * POST /api/payments/lock
 * Khóa tiền escrow cho batch
 * Body: { tokenId, payeeWallet, amountWei, flatFeeWei,
 *         customerId, carrierId, billingDetail, callerWallet }
 */
async function lockPayment(req, res) {
  try {
    const result = await svc.lockPayment(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/payments/:tokenId/release
 * Giải ngân escrow — batch phải Delivered hoặc Cleared
 * Body: { callerWallet }
 */
async function releasePayment(req, res) {
  try {
    const { tokenId } = req.params;
    const result = await svc.releasePayment({ tokenId, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/payments/:tokenId/escrow
 * Lấy trạng thái escrow (on-chain + off-chain)
 */
async function getEscrow(req, res) {
  try {
    const { tokenId } = req.params;
    const result = await svc.getEscrowDetail(tokenId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const paymentController = { lockPayment, releasePayment, getEscrow };

module.exports = {
  batch:   { createBatch, getBatch, transferCustody, updateCustody },
  issue:   issueController,
  payment: paymentController,
};
