// ============================================================
// blockchain.js — Kết nối ethers.js với BlockTrace contract
// ============================================================
// Cài đặt: npm install ethers dotenv
// Tạo file .env theo mẫu .env.example bên dưới
// ============================================================

const { ethers } = require("ethers");

// ─── ABI — chỉ giữ các hàm backend cần gọi ─────────────────
const CONTRACT_ABI = [
  // --- Batch ---
  "function createBatch(bytes32 metadataHash, string calldata metadataCID) external returns (uint256 batchId)",
  "function transferCustody(uint256 batchId, address to) external",
  "function updateCustody(uint256 batchId, bytes32 updateHash, string calldata note) external",
  "function getBatchStatus(uint256 batchId) external view returns (uint8)",
  "function getCurrentOwner(uint256 batchId) external view returns (address)",
  "function getCustodyLog(uint256 batchId) external view returns (uint256[] memory)",
  "function batches(uint256 batchId) external view returns (uint256 id, bytes32 metadataHash, string metadataCID, address producer, address currentOwner, uint256 createdAt, uint8 status, bool exists, uint256 openIssueCount)",

  // --- Issue ---
  "function reportIssue(uint256 batchId, bytes32 issueHash, string calldata issueType) external returns (uint256 issueId)",
  "function anchorEvidence(uint256 issueId, bytes32 evidenceHash) external",
  "function confirmResolution(uint256 issueId) external",
  "function resolveIssue(uint256 issueId, bytes32 settlementHash, uint8 resolution, uint256 refundAmount) external",
  "function getIssuesByBatch(uint256 batchId) external view returns (uint256[] memory)",
  "function getOpenIssueCount(uint256 batchId) external view returns (uint256)",
  "function isResolutionConfirmed(uint256 issueId) external view returns (bool)",
  "function issues(uint256 issueId) external view returns (uint256 id, uint256 batchId, bytes32 issueHash, string issueType, address reporter, uint256 reportedAt, uint8 status, bytes32 evidenceHash, bytes32 settlementHash, uint8 resolutionType, uint256 refundAmount, address resolvedBy, uint256 resolvedAt, bool stakeholderConfirmed)",

  // --- Escrow ---
  "function lockPayment(uint256 batchId, address payee, uint256 flatFee) external payable returns (uint256 lockedAmount)",
  "function releasePayment(uint256 batchId) external",
  "function escrows(uint256 batchId) external view returns (uint256 batchId_, address payer, address payee, uint256 amount, uint256 flatFee, uint256 lockedAt, uint256 settledAt, uint8 status, bool exists)",

  // --- Admin ---
  "function pause() external",
  "function unpause() external",

  // --- Events ---
  "event BatchCreated(uint256 indexed batchId, bytes32 metadataHash, string metadataCID, address indexed producer, uint256 createdAt)",
  "event BatchStatusChanged(uint256 indexed batchId, uint8 oldStatus, uint8 newStatus, address indexed changedBy, uint256 timestamp)",
  "event CustodyTransferred(uint256 indexed batchId, address indexed from, address indexed to, uint256 timestamp)",
  "event CustodyUpdated(uint256 indexed custodyId, uint256 indexed batchId, address indexed actor, bytes32 updateHash, string note, uint256 timestamp)",
  "event IssueOpened(uint256 indexed issueId, uint256 indexed batchId, bytes32 issueHash, string issueType, address indexed reporter, uint256 reportedAt)",
  "event EvidenceAnchored(uint256 indexed issueId, bytes32 evidenceHash, address indexed anchoredBy, uint256 timestamp)",
  "event ResolutionConfirmed(uint256 indexed issueId, address indexed confirmedBy, uint256 timestamp)",
  "event IssueSettled(uint256 indexed issueId, uint256 indexed batchId, uint8 finalStatus, uint8 resolutionType, bytes32 settlementHash, uint256 refundAmount, address indexed resolvedBy, uint256 resolvedAt)",
  "event PaymentLocked(uint256 indexed batchId, address indexed payer, address indexed payee, uint256 amount, uint256 flatFee, uint256 timestamp)",
  "event PaymentReleased(uint256 indexed batchId, address indexed payee, uint256 amount, uint256 flatFee, uint256 timestamp)",
  "event PaymentRefunded(uint256 indexed batchId, address indexed payer, uint256 refundAmount, uint8 resolutionType, uint256 timestamp)",
];

// ─── Enum maps — đồng bộ với Solidity ───────────────────────
const BatchStatus = {
  0: "Minted",
  1: "InTransit",
  2: "Delivered",
  3: "UnderReview",
  4: "Recalled",
  5: "Cleared",
};

const IssueStatus = {
  0: "Open",
  1: "UnderReview",
  2: "Resolved",
  3: "Recalled",
};

const ResolutionType = {
  None:          0,
  Cleared:       1,
  Refund:        2,
  RefundPartial: 3,
  Replaced:      4,
  Recalled:      5,
};

const EscrowStatus = {
  0: "None",
  1: "Locked",
  2: "Released",
  3: "Refunded",
  4: "PartiallyRefunded",
};

// ─── Role constants — đồng bộ với Solidity keccak256 ────────
// Dùng để kiểm tra role trên backend trước khi gọi contract
const ROLES = {
  // DEFAULT_ADMIN_ROLE = bytes32(0) theo chuẩn OpenZeppelin
  DEFAULT_ADMIN:  "0x0000000000000000000000000000000000000000000000000000000000000000",
  PRODUCER:       ethers.id("PRODUCER_ROLE"),
  DISTRIBUTOR:    ethers.id("DISTRIBUTOR_ROLE"),
  RETAILER:       ethers.id("RETAILER_ROLE"),
  INSPECTOR:      ethers.id("INSPECTOR_ROLE"),
  RESOLVER:       ethers.id("RESOLVER_ROLE"),       // ✅ đúng tên trong contract
  AUDITOR:        ethers.id("AUDITOR_ROLE"),
};

// ─── Ghi chú phân quyền quan trọng ─────────────────────────
//
// confirmResolution(issueId):
//   ✅ PRODUCER_ROLE, DISTRIBUTOR_ROLE, RETAILER_ROLE
//   ❌ INSPECTOR_ROLE, RESOLVER_ROLE (không được self-approve)
//
// resolveIssue(issueId, ...):
//   ✅ RESOLVER_ROLE
//   ❌ Tất cả role khác
//
// reportIssue / anchorEvidence:
//   ✅ INSPECTOR_ROLE, DISTRIBUTOR_ROLE, RETAILER_ROLE
//   ❌ PRODUCER_ROLE, RESOLVER_ROLE

// ─── Provider & Signer factory ───────────────────────────────
let _provider = null;

/**
 * Trả về JsonRpcProvider (singleton).
 * RPC_URL ví dụ: https://sepolia.infura.io/v3/<KEY>
 */
function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }
  return _provider;
}

/**
 * Trả về Wallet đã kết nối provider.
 * Mỗi role nên dùng một private key riêng trong production.
 * @param {string} [privateKey] - override key nếu cần; mặc định dùng PRIVATE_KEY từ env
 */
function getSigner(privateKey) {
  const key = privateKey || process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY chưa được cấu hình trong .env");
  return new ethers.Wallet(key, getProvider());
}

/**
 * Trả về contract instance (read-only nếu không truyền signer).
 * @param {ethers.Signer|null} signer
 */
function getContract(signer = null) {
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS chưa được cấu hình trong .env");
  const runner = signer || getProvider();
  return new ethers.Contract(address, CONTRACT_ABI, runner);
}

module.exports = {
  getProvider,
  getSigner,
  getContract,
  BatchStatus,
  IssueStatus,
  ResolutionType,
  EscrowStatus,
  CONTRACT_ABI,
  ROLES,
};

// ─── .env.example ────────────────────────────────────────────
// RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
// CONTRACT_ADDRESS=0xYourDeployedContractAddress
// PRIVATE_KEY=0xYourPrivateKey
// PORT=3000
// MONGO_URI=mongodb://localhost:27017/blocktrace
