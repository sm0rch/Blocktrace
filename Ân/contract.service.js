// ============================================================
// contract.service.js — Gọi smart contract + sync MongoDB
// ============================================================
// Layer này:
//   1. Gọi hàm write lên blockchain (tx → wait → receipt)
//   2. Sync kết quả về MongoDB (off-chain mirror)
//   3. Gọi hàm view để đọc trạng thái on-chain
// ============================================================

const { ethers }    = require("ethers");
const { getSigner, getContract, getProvider, BatchStatus, IssueStatus, ResolutionType, EscrowStatus } = require("../config/blockchain");
const {
  BatchNFT,
  QRCode,
  Transaction,
  BillingDetail,
  ShipmentLog,
  IssueReport,
  Resolution,
  QueryHistory,
} = require("../../models/schema"); // MongoDB models

// ─────────────────────────────────────────────────────────────
// HELPER: đợi tx và trả về receipt + parsed logs
// ─────────────────────────────────────────────────────────────
async function sendTx(contractWithSigner, method, args = [], overrides = {}) {
  const tx      = await contractWithSigner[method](...args, overrides);
  const receipt = await tx.wait();
  return { tx, receipt };
}

// ─────────────────────────────────────────────────────────────
// BATCH SERVICES
// ─────────────────────────────────────────────────────────────

/**
 * Tạo batch mới: hash metadata → gọi createBatch → lưu MongoDB.
 *
 * @param {object} params
 * @param {string} params.producerId       - MongoDB producer_id
 * @param {string} params.productName
 * @param {string} params.origin
 * @param {string} params.harvestDate      - ISO date string
 * @param {string} params.certification
 * @param {string} params.batchNumber
 * @param {string} params.metadataCID      - IPFS CID của file JSON metadata
 * @param {string} params.metadataHashHex  - "0x..." SHA-256 hash của metadata JSON
 * @param {string} params.producerWallet   - private key của producer (từ auth middleware)
 */
async function createBatch(params) {
  const {
    producerId, productName, origin, harvestDate,
    certification, batchNumber,
    metadataCID, metadataHashHex, producerWallet,
  } = params;

  // 1. Gọi smart contract
  const signer   = getSigner(producerWallet);
  const contract = getContract(signer);

  const { tx, receipt } = await sendTx(contract, "createBatch", [
    metadataHashHex,
    metadataCID,
  ]);

  // 2. Parse event BatchCreated để lấy batchId on-chain
  const iface   = contract.interface;
  const batchCreatedLog = receipt.logs
    .map(log => { try { return iface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "BatchCreated");

  const tokenId = batchCreatedLog.args.batchId.toString();

  // 3. Lưu MongoDB
  const batchDoc = await BatchNFT.create({
    tokenId,
    producer_id:            producerId,
    productName,
    origin,
    harvestDate:            new Date(harvestDate),
    certification,
    batchNumber,
    blockchain_tx_hash:     tx.hash,
    smart_contract_address: process.env.CONTRACT_ADDRESS,
    metadata_ipfs_cid:      metadataCID,
    current_status:         "MINTED",
    current_owner_wallet:   signer.address,
  });

  // 4. Tạo QR code record
  await QRCode.create({
    qr_id:       `qr-${tokenId}`,
    tokenId,
    url:         `${process.env.APP_URL}/verify/${tokenId}`,
    generated_at: new Date(),
  });

  return {
    tokenId,
    blockchain_tx_hash: tx.hash,
    block:              receipt.blockNumber,
    batch:              batchDoc,
  };
}

/**
 * Chuyển custody lô hàng sang distributor / retailer.
 *
 * @param {object} params
 * @param {string} params.tokenId
 * @param {string} params.toWallet       - ví nhận (phải có DISTRIBUTOR/RETAILER role)
 * @param {string} params.callerWallet   - private key của người gọi (currentOwner)
 */
async function transferCustody(params) {
  const { tokenId, toWallet, callerWallet } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx, receipt } = await sendTx(contract, "transferCustody", [
    BigInt(tokenId),
    toWallet,
  ]);

  // Parse BatchStatusChanged event để lấy status mới
  const iface       = contract.interface;
  const statusEvent = receipt.logs
    .map(log => { try { return iface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "BatchStatusChanged");

  const newStatus = BatchStatus[Number(statusEvent.args.newStatus)];

  // Sync MongoDB
  await BatchNFT.findOneAndUpdate(
    { tokenId },
    {
      current_status:       newStatus.toUpperCase(),
      current_owner_wallet: toWallet,
      blockchain_tx_hash:   tx.hash,
    }
  );

  return { tokenId, newStatus, blockchain_tx_hash: tx.hash };
}

/**
 * Ghi mốc vận chuyển (IoT/logistics checkpoint).
 *
 * @param {object} params
 * @param {string} params.tokenId
 * @param {string} params.txId            - MongoDB transaction id
 * @param {string} params.updateHashHex   - "0x..." hash dữ liệu custody off-chain
 * @param {string} params.note            - "Rời kho HCM"
 * @param {object} params.iotData         - { temperature_logs, humidity_logs, gps_tracking... }
 * @param {string} params.callerWallet
 */
async function updateCustody(params) {
  const { tokenId, txId, updateHashHex, note, iotData, callerWallet } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx } = await sendTx(contract, "updateCustody", [
    BigInt(tokenId),
    updateHashHex,
    note,
  ]);

  // Lưu IoT data vào ShipmentLog (off-chain)
  const logDoc = await ShipmentLog.create({
    log_id:   `shiplog-${Date.now()}`,
    tx_id:    txId,
    tokenId,
    temperature_logs:    iotData?.temperature_logs    || [],
    humidity_logs:       iotData?.humidity_logs       || [],
    gps_tracking:        iotData?.gps_tracking        || [],
    door_events:         iotData?.door_events         || [],
    logistics_documents: iotData?.logistics_documents || [],
    logged_at: new Date(),
  });

  return { tokenId, note, blockchain_tx_hash: tx.hash, shipment_log_id: logDoc.log_id };
}

/**
 * Đọc trạng thái batch từ on-chain + lấy off-chain data từ MongoDB.
 *
 * @param {string} tokenId
 * @param {string} [queriedById]   - null nếu anonymous
 * @param {string} [queriedByType] - "Producer" | "Carrier" | "Customer" | "Anonymous"
 */
async function getBatchDetail(tokenId, queriedById = null, queriedByType = "Anonymous") {
  const contract = getContract(); // read-only

  // Đọc on-chain
  const onChainBatch = await contract.batches(BigInt(tokenId));
  const onChainStatus = BatchStatus[Number(onChainBatch.status)];

  // Đọc off-chain MongoDB
  const batchDoc = await BatchNFT.findOne({ tokenId });

  // Ghi lịch sử truy vấn
  await QueryHistory.create({
    query_id:       `qh-${Date.now()}`,
    tokenId,
    queried_by_type: queriedByType,
    queried_by_id:   queriedById,
    integrity_check: null, // FE sẽ tự verify hash
    queried_at:      new Date(),
  });

  return {
    tokenId,
    on_chain: {
      producer:      onChainBatch.producer,
      currentOwner:  onChainBatch.currentOwner,
      metadataHash:  onChainBatch.metadataHash,
      metadataCID:   onChainBatch.metadataCID,
      status:        onChainStatus,
      createdAt:     Number(onChainBatch.createdAt),
      openIssueCount: Number(onChainBatch.openIssueCount),
    },
    off_chain: batchDoc,
  };
}

// ─────────────────────────────────────────────────────────────
// ISSUE SERVICES
// ─────────────────────────────────────────────────────────────

/**
 * Mở issue và khóa batch sang UnderReview.
 *
 * @param {object} params
 * @param {string} params.tokenId
 * @param {string} params.issueHashHex     - "0x..." hash mô tả lỗi off-chain
 * @param {string} params.issueType        - "TEMPERATURE_VIOLATION" | "DAMAGED" | ...
 * @param {string} params.issueDescription - mô tả chi tiết (lưu off-chain)
 * @param {string} params.reporterId       - MongoDB ID người báo
 * @param {string} params.reporterType     - "Producer" | "Carrier" | "Customer" | "Inspector"
 * @param {string} params.callerWallet
 */
async function reportIssue(params) {
  const {
    tokenId, issueHashHex, issueType,
    issueDescription, reporterId, reporterType,
    callerWallet,
  } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx, receipt } = await sendTx(contract, "reportIssue", [
    BigInt(tokenId),
    issueHashHex,
    issueType,
  ]);

  // Parse IssueOpened event để lấy issueId on-chain
  const iface       = contract.interface;
  const issueEvent  = receipt.logs
    .map(log => { try { return iface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === "IssueOpened");

  const issueId = issueEvent.args.issueId.toString();

  // Sync MongoDB
  const issueDoc = await IssueReport.create({
    issue_id:           `issue-${issueId}`,
    tokenId,
    reporter_type:       reporterType,
    reporter_id:         reporterId,
    issue_type:          mapIssueType(issueType),
    issue_description:   issueDescription,
    blockchain_tx_hash:  tx.hash,
    issue_status:        "Under_Review",
    reported_at:         new Date(),
  });

  // Sync batch status
  await BatchNFT.findOneAndUpdate({ tokenId }, { current_status: "UNDER_REVIEW" });

  return {
    issueId,
    tokenId,
    blockchain_tx_hash: tx.hash,
    issue: issueDoc,
  };
}

/**
 * Neo hash bằng chứng off-chain lên on-chain.
 *
 * @param {object} params
 * @param {string} params.issueId          - on-chain issueId (số)
 * @param {string} params.evidenceHashHex  - "0x..." hash gói bằng chứng
 * @param {string[]} params.evidenceCIDs   - danh sách CID IPFS ảnh/video
 * @param {string} params.callerWallet
 */
async function anchorEvidence(params) {
  const { issueId, evidenceHashHex, evidenceCIDs, callerWallet } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx } = await sendTx(contract, "anchorEvidence", [
    BigInt(issueId),
    evidenceHashHex,
  ]);

  // Sync MongoDB — thêm CIDs bằng chứng
  await IssueReport.findOneAndUpdate(
    { issue_id: `issue-${issueId}` },
    { $push: { evidence_ipfs_cids: { $each: evidenceCIDs || [] } } }
  );

  return { issueId, blockchain_tx_hash: tx.hash };
}

/**
 * Bên liên quan xác nhận đồng ý phương án xử lý.
 *
 * @param {object} params
 * @param {string} params.issueId
 * @param {string} params.callerWallet
 */
async function confirmResolution(params) {
  const { issueId, callerWallet } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx } = await sendTx(contract, "confirmResolution", [BigInt(issueId)]);

  return { issueId, confirmed: true, blockchain_tx_hash: tx.hash };
}

/**
 * Resolver chốt phương án xử lý và đóng issue.
 *
 * @param {object} params
 * @param {string} params.issueId
 * @param {string} params.settlementHashHex  - "0x..." hash biên bản thỏa thuận
 * @param {string} params.resolutionType     - "Cleared" | "Refund" | "RefundPartial" | "Replaced" | "Recalled"
 * @param {number} params.refundAmount       - wei, 0 nếu không hoàn tiền
 * @param {string} params.resolvedById       - MongoDB ID resolver
 * @param {string} params.resolutionDescription
 * @param {string} params.settlementDocUrl   - URL biên bản PDF trên IPFS
 * @param {string} params.callerWallet
 */
async function resolveIssue(params) {
  const {
    issueId, settlementHashHex, resolutionType,
    refundAmount, resolvedById,
    resolutionDescription, settlementDocUrl,
    callerWallet,
  } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const resolutionCode = ResolutionType[resolutionType];
  if (resolutionCode === undefined) throw new Error(`ResolutionType không hợp lệ: ${resolutionType}`);

  const { tx } = await sendTx(contract, "resolveIssue", [
    BigInt(issueId),
    settlementHashHex,
    resolutionCode,
    BigInt(refundAmount || 0),
  ]);

  // Tính financial_impact
  const financialImpact =
    resolutionType === "Refund" || resolutionType === "RefundPartial" ? "Refund" :
    resolutionType === "Recalled" ? "Deduct_Carrier" : "No_Action";

  // Tạo Resolution doc
  const resolutionDoc = await Resolution.create({
    resolution_id:          `res-${issueId}-${Date.now()}`,
    issue_id:               `issue-${issueId}`,
    resolution_type:         resolutionType === "RefundPartial" ? "Refund" : resolutionType,
    resolved_by:             resolvedById,
    resolution_description:  resolutionDescription,
    settlement_doc_url:      settlementDocUrl,
    financial_impact:        financialImpact,
    refund_amount:           refundAmount || 0,
    recall_batch:            resolutionType === "Recalled",
    blockchain_tx_hash:      tx.hash,
    resolved_at:             new Date(),
  });

  // Sync IssueReport status
  await IssueReport.findOneAndUpdate(
    { issue_id: `issue-${issueId}` },
    { issue_status: "Resolved" }
  );

  // Sync BatchNFT nếu Recalled
  if (resolutionType === "Recalled") {
    const issueDoc = await IssueReport.findOne({ issue_id: `issue-${issueId}` });
    if (issueDoc) {
      await BatchNFT.findOneAndUpdate(
        { tokenId: issueDoc.tokenId },
        { current_status: "RECALLED", is_recalled: true }
      );
    }
  }

  return {
    issueId,
    resolution: resolutionDoc,
    blockchain_tx_hash: tx.hash,
  };
}

// ─────────────────────────────────────────────────────────────
// ESCROW / PAYMENT SERVICES
// ─────────────────────────────────────────────────────────────

/**
 * Khóa tiền escrow cho một batch.
 *
 * @param {object} params
 * @param {string} params.tokenId
 * @param {string} params.payeeWallet    - ví producer/seller nhận tiền
 * @param {string} params.amountWei      - số tiền (wei) dưới dạng string
 * @param {string} params.flatFeeWei     - phí cố định (wei)
 * @param {string} params.customerId     - MongoDB customer_id
 * @param {string} params.carrierId      - MongoDB carrier_id
 * @param {object} params.billingDetail  - { flat_fee, logistics_fee, tax_amount, total_amount }
 * @param {string} params.callerWallet   - private key buyer
 */
async function lockPayment(params) {
  const {
    tokenId, payeeWallet, amountWei, flatFeeWei,
    customerId, carrierId, billingDetail, callerWallet,
  } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx } = await sendTx(
    contract,
    "lockPayment",
    [BigInt(tokenId), payeeWallet, BigInt(flatFeeWei)],
    { value: BigInt(amountWei) }
  );

  const txId = `tx-${tokenId}-${Date.now()}`;

  // Tạo Transaction doc
  const txDoc = await Transaction.create({
    tx_id:                  txId,
    tokenId,
    carrier_id:             carrierId,
    customer_id:            customerId,
    escrow_status:          "Locked",
    escrow_amount:          Number(ethers.formatEther(amountWei)),
    blockchain_tx_hash:     tx.hash,
    smart_contract_address: process.env.CONTRACT_ADDRESS,
    order_status:           "PAYMENT_HELD_IN_ESCROW",
  });

  // Tạo BillingDetail doc
  await BillingDetail.create({
    billing_id:     `bill-${txId}`,
    tx_id:          txId,
    flat_fee:       billingDetail?.flat_fee       || 0,
    logistics_fee:  billingDetail?.logistics_fee  || 0,
    tax_amount:     billingDetail?.tax_amount     || 0,
    total_amount:   billingDetail?.total_amount   || Number(ethers.formatEther(amountWei)),
    billing_status: "Pending",
  });

  return { txId, tokenId, blockchain_tx_hash: tx.hash, transaction: txDoc };
}

/**
 * Giải ngân escrow — batch phải Delivered hoặc Cleared.
 *
 * @param {object} params
 * @param {string} params.tokenId
 * @param {string} params.callerWallet
 */
async function releasePayment(params) {
  const { tokenId, callerWallet } = params;

  const signer   = getSigner(callerWallet);
  const contract = getContract(signer);

  const { tx } = await sendTx(contract, "releasePayment", [BigInt(tokenId)]);

  // Sync MongoDB
  await Transaction.findOneAndUpdate(
    { tokenId, escrow_status: "Locked" },
    {
      escrow_status:       "Released",
      payment_released_at: new Date(),
      payment_released_reason: "Delivery confirmed",
      order_status:        "FUND_RELEASED",
    }
  );

  await BillingDetail.findOneAndUpdate(
    { tx_id: { $regex: `tx-${tokenId}` } },
    { billing_status: "Paid" }
  );

  return { tokenId, released: true, blockchain_tx_hash: tx.hash };
}

// ─────────────────────────────────────────────────────────────
// VIEW HELPERS
// ─────────────────────────────────────────────────────────────

async function getIssueDetail(issueId) {
  const contract    = getContract();
  const onChain     = await contract.issues(BigInt(issueId));
  const offChain    = await IssueReport.findOne({ issue_id: `issue-${issueId}` });
  const resolution  = await Resolution.findOne({ issue_id: `issue-${issueId}` });

  return {
    issueId,
    on_chain: {
      batchId:              onChain.batchId.toString(),
      issueHash:            onChain.issueHash,
      issueType:            onChain.issueType,
      reporter:             onChain.reporter,
      reportedAt:           Number(onChain.reportedAt),
      status:               IssueStatus[Number(onChain.status)],
      evidenceHash:         onChain.evidenceHash,
      settlementHash:       onChain.settlementHash,
      resolutionType:       Object.keys(ResolutionType).find(k => ResolutionType[k] === Number(onChain.resolutionType)),
      refundAmount:         onChain.refundAmount.toString(),
      resolvedBy:           onChain.resolvedBy,
      stakeholderConfirmed: onChain.stakeholderConfirmed,
    },
    off_chain:  offChain,
    resolution: resolution,
  };
}

async function getEscrowDetail(tokenId) {
  const contract = getContract();
  const escrow   = await contract.escrows(BigInt(tokenId));
  const txDoc    = await Transaction.findOne({ tokenId });

  return {
    tokenId,
    on_chain: {
      payer:     escrow.payer,
      payee:     escrow.payee,
      amount:    ethers.formatEther(escrow.amount),
      flatFee:   ethers.formatEther(escrow.flatFee),
      status:    EscrowStatus[Number(escrow.status)],
      lockedAt:  Number(escrow.lockedAt),
      settledAt: Number(escrow.settledAt),
    },
    off_chain: txDoc,
  };
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

function mapIssueType(issueType) {
  const map = {
    TEMPERATURE_VIOLATION: "Temperature_Violation",
    DAMAGED:   "Damaged",
    SPOILED:   "Spoiled",
    MISSING:   "Missing",
    DELAYED:   "Delayed",
    BATCH_MISMATCH: "Batch_Mismatch",
  };
  return map[issueType] || "Other";
}

module.exports = {
  // Batch
  createBatch,
  transferCustody,
  updateCustody,
  getBatchDetail,
  // Issue
  reportIssue,
  anchorEvidence,
  confirmResolution,
  resolveIssue,
  getIssueDetail,
  // Payment
  lockPayment,
  releasePayment,
  getEscrowDetail,
};
