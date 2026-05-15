// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  Counter
 * @notice Accountability infrastructure cho chuỗi cung ứng.
 *
 * Kiến trúc Plan → Execute → Log:
 *  - Dữ liệu nhạy cảm (ảnh, biên bản, video) lưu OFF-CHAIN (IPFS/CID).
 *  - On-chain chỉ giữ hash, trạng thái, timestamp, và actor.
 *  - Mọi state transition đều emit event để backend index và FE tái dựng timeline.
 *
 * Roles:
 *  - DEFAULT_ADMIN_ROLE : cấp/thu hồi mọi role khác
 *  - PRODUCER_ROLE      : tạo batch, neo metadata hash
 *  - DISTRIBUTOR_ROLE   : cập nhật custody mốc vận chuyển
 *  - INSPECTOR_ROLE     : mở issue, khóa batch sang under_review
 *  - RESOLVER_ROLE      : chốt settlement, chuyển issue sang resolved/recalled
 */
contract Counter is AccessControl {

    // ─────────────────────────────────────────────
    //  Roles
    // ─────────────────────────────────────────────

    bytes32 public constant PRODUCER_ROLE    = keccak256("PRODUCER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant INSPECTOR_ROLE   = keccak256("INSPECTOR_ROLE");
    bytes32 public constant RESOLVER_ROLE    = keccak256("RESOLVER_ROLE");

    // ─────────────────────────────────────────────
    //  Enums
    // ─────────────────────────────────────────────

    enum BatchStatus {
        Active,        // đang lưu hành bình thường
        UnderReview,   // bị khóa do có issue
        Recalled,      // bị thu hồi
        Cleared        // đã xử lý xong, trở lại bình thường
    }

    enum IssueStatus {
        Open,          // vừa được mở
        UnderReview,   // đang thu thập chứng cứ
        Resolved,      // đã xử lý xong
        Recalled       // dẫn đến thu hồi lô
    }

    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────

    struct Batch {
        uint256     id;
        bytes32     metadataHash;   // hash của metadata off-chain (IPFS CID hoặc SHA-256)
        address     producer;
        uint256     createdAt;
        BatchStatus status;
        bool        exists;
    }

    struct CustodyUpdate {
        uint256 batchId;
        address actor;          // distributor hoặc retailer
        bytes32 updateHash;     // hash của dữ liệu custody off-chain
        uint256 timestamp;
        string  note;           // mô tả ngắn: "Rời kho HCM", "Đến DC Hà Nội"...
    }

    struct Issue {
        uint256     id;
        uint256     batchId;
        bytes32     issueHash;      // hash của mô tả lỗi off-chain
        address     reporter;
        uint256     reportedAt;
        IssueStatus status;
        bytes32     evidenceHash;   // hash của chứng cứ off-chain (ảnh, biên bản...)
        bytes32     settlementHash; // hash của phương án xử lý off-chain
        address     resolvedBy;
        uint256     resolvedAt;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    uint256 private _nextBatchId;
    uint256 private _nextIssueId;
    uint256 private _nextCustodyId;

    mapping(uint256 => Batch)          public batches;
    mapping(uint256 => Issue)          public issues;
    mapping(uint256 => CustodyUpdate)  public custodyUpdates;

    mapping(uint256 => uint256[]) public batchIssues;       // batchId → issueIds
    mapping(uint256 => uint256[]) public batchCustodyLog;   // batchId → custodyUpdateIds

    // ─────────────────────────────────────────────
    //  Events — FE/backend subscribe để dựng timeline
    // ─────────────────────────────────────────────

    // --- Batch lifecycle ---

    /// @notice Batch mới được tạo bởi producer
    event BatchCreated(
        uint256 indexed batchId,
        bytes32         metadataHash,
        address indexed producer,
        uint256         createdAt
    );

    /// @notice Trạng thái batch thay đổi
    event BatchStatusChanged(
        uint256 indexed batchId,
        BatchStatus     oldStatus,
        BatchStatus     newStatus,
        address indexed changedBy,
        uint256         timestamp
    );

    // --- Custody lifecycle ---

    /// @notice Distributor/retailer cập nhật một mốc vận chuyển
    event CustodyUpdated(
        uint256 indexed custodyId,
        uint256 indexed batchId,
        address indexed actor,
        bytes32         updateHash,
        string          note,
        uint256         timestamp
    );

    // --- Issue lifecycle ---

    /// @notice Issue mới được mở (batch đồng thời chuyển sang UnderReview)
    event IssueOpened(
        uint256 indexed issueId,
        uint256 indexed batchId,
        bytes32         issueHash,
        address indexed reporter,
        uint256         reportedAt
    );

    /// @notice Chứng cứ off-chain được neo hash lên chain
    event EvidenceAnchored(
        uint256 indexed issueId,
        bytes32         evidenceHash,
        address indexed anchoredBy,
        uint256         timestamp
    );

    /// @notice Issue được chốt (resolved hoặc recall)
    event IssueSettled(
        uint256 indexed issueId,
        uint256 indexed batchId,
        IssueStatus     finalStatus,
        bytes32         settlementHash,
        address indexed resolvedBy,
        uint256         resolvedAt
    );

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─────────────────────────────────────────────
    //  PLAN: Producer tạo batch
    // ─────────────────────────────────────────────

    /**
     * @notice Tạo batch mới và neo metadata hash lên chain.
     * @param metadataHash Hash SHA-256 hoặc IPFS CID của metadata off-chain
     *                     (mã lô, ngày sản xuất, xuất xứ, thành phần...).
     * @return batchId     ID của batch vừa tạo.
     *
     * @dev Chỉ PRODUCER_ROLE mới được gọi.
     *      Dữ liệu thật lưu off-chain; on-chain chỉ giữ hash để FE tái xác minh
     *      bằng cách: fetch CID → recompute hash → so với metadataHash on-chain.
     */
    function createBatch(bytes32 metadataHash)
        external
        onlyRole(PRODUCER_ROLE)
        returns (uint256 batchId)
    {
        require(metadataHash != bytes32(0), "createBatch: metadataHash required");

        batchId = _nextBatchId++;

        batches[batchId] = Batch({
            id:           batchId,
            metadataHash: metadataHash,
            producer:     msg.sender,
            createdAt:    block.timestamp,
            status:       BatchStatus.Active,
            exists:       true
        });

        emit BatchCreated(batchId, metadataHash, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE: Distributor cập nhật custody
    // ─────────────────────────────────────────────

    /**
     * @notice Ghi lại một mốc custody/vận chuyển.
     * @param batchId    ID batch đang vận chuyển.
     * @param updateHash Hash của dữ liệu custody off-chain (tọa độ, thời gian thực tế...).
     * @param note       Mô tả ngắn hiển thị trực tiếp trên timeline.
     *
     * @dev Chỉ DISTRIBUTOR_ROLE. Batch phải đang Active.
     *      "Procedural truth" được ghi tại thời điểm gọi hàm;
     *      trễ cập nhật là giới hạn của oracle governance, không phải lỗi contract.
     */
    function updateCustody(
        uint256 batchId,
        bytes32 updateHash,
        string calldata note
    )
        external
        onlyRole(DISTRIBUTOR_ROLE)
    {
        require(batches[batchId].exists,                        "updateCustody: batch not found");
        require(batches[batchId].status == BatchStatus.Active,  "updateCustody: batch not active");
        require(updateHash != bytes32(0),                       "updateCustody: updateHash required");
        require(bytes(note).length > 0,                         "updateCustody: note required");

        uint256 custodyId = _nextCustodyId++;

        custodyUpdates[custodyId] = CustodyUpdate({
            batchId:   batchId,
            actor:     msg.sender,
            updateHash: updateHash,
            timestamp: block.timestamp,
            note:      note
        });

        batchCustodyLog[batchId].push(custodyId);

        emit CustodyUpdated(custodyId, batchId, msg.sender, updateHash, note, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  PLAN (báo lỗi): Inspector mở issue
    // ─────────────────────────────────────────────

    /**
     * @notice Mở issue và khóa batch sang UnderReview.
     * @param batchId   ID batch có bất thường.
     * @param issueHash Hash của mô tả issue off-chain (loại lỗi, mức độ, mã inspector...).
     * @return issueId  ID của issue vừa tạo.
     *
     * @dev Chỉ INSPECTOR_ROLE. Batch chuyển Active → UnderReview ngay khi issue được mở.
     *      Không xóa bất kỳ dấu vết nào — mọi thứ là state transition mới.
     */
    function reportIssue(uint256 batchId, bytes32 issueHash)
        external
        onlyRole(INSPECTOR_ROLE)
        returns (uint256 issueId)
    {
        require(batches[batchId].exists,                       "reportIssue: batch not found");
        require(batches[batchId].status == BatchStatus.Active, "reportIssue: batch not active");
        require(issueHash != bytes32(0),                       "reportIssue: issueHash required");

        issueId = _nextIssueId++;

        issues[issueId] = Issue({
            id:             issueId,
            batchId:        batchId,
            issueHash:      issueHash,
            reporter:       msg.sender,
            reportedAt:     block.timestamp,
            status:         IssueStatus.Open,
            evidenceHash:   bytes32(0),
            settlementHash: bytes32(0),
            resolvedBy:     address(0),
            resolvedAt:     0
        });

        batchIssues[batchId].push(issueId);

        // Khóa batch ngay khi có issue
        _changeBatchStatus(batchId, BatchStatus.UnderReview);

        emit IssueOpened(issueId, batchId, issueHash, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE (báo lỗi): Neo hash chứng cứ off-chain
    // ─────────────────────────────────────────────

    /**
     * @notice Neo hash của chứng cứ off-chain (ảnh, biên bản, video...).
     * @param issueId      ID issue đang xử lý.
     * @param evidenceHash Hash SHA-256 của gói chứng cứ off-chain.
     *
     * @dev Chỉ INSPECTOR_ROLE. Issue phải đang Open hoặc UnderReview.
     *      Tách on-chain/off-chain giúp tránh nhân bản dữ liệu nhạy cảm lên ledger
     *      (theo khuyến nghị của Sedlmeir et al. về transparency challenge).
     */
    function anchorEvidence(uint256 issueId, bytes32 evidenceHash)
        external
        onlyRole(INSPECTOR_ROLE)
    {
        Issue storage issue = issues[issueId];

        require(issue.reportedAt != 0,                                          "anchorEvidence: issue not found");
        require(issue.status == IssueStatus.Open ||
                issue.status == IssueStatus.UnderReview,                        "anchorEvidence: issue not open");
        require(evidenceHash != bytes32(0),                                     "anchorEvidence: evidenceHash required");

        issue.evidenceHash = evidenceHash;
        issue.status       = IssueStatus.UnderReview;

        emit EvidenceAnchored(issueId, evidenceHash, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  LOG: Resolver chốt settlement
    // ─────────────────────────────────────────────

    /**
     * @notice Chốt phương án xử lý issue và cập nhật trạng thái batch.
     * @param issueId        ID issue cần chốt.
     * @param settlementHash Hash của phương án xử lý off-chain (hoàn tiền, đổi trả...).
     * @param recall         true  → issue dẫn đến thu hồi lô (Recalled)
     *                       false → issue đã xử lý, lô được thông (Cleared)
     *
     * @dev Chỉ RESOLVER_ROLE. Không overwrite lịch sử — chỉ thêm state mới.
     *      Lịch sử đầy đủ có thể tái dựng từ event logs (non-repudiation).
     */
    function resolveIssue(
        uint256 issueId,
        bytes32 settlementHash,
        bool    recall
    )
        external
        onlyRole(RESOLVER_ROLE)
    {
        Issue storage issue = issues[issueId];

        require(issue.reportedAt != 0,                    "resolveIssue: issue not found");
        require(issue.status != IssueStatus.Resolved &&
                issue.status != IssueStatus.Recalled,     "resolveIssue: already settled");
        require(settlementHash != bytes32(0),             "resolveIssue: settlementHash required");

        IssueStatus finalIssueStatus  = recall ? IssueStatus.Recalled  : IssueStatus.Resolved;
        BatchStatus finalBatchStatus  = recall ? BatchStatus.Recalled   : BatchStatus.Cleared;

        issue.status         = finalIssueStatus;
        issue.settlementHash = settlementHash;
        issue.resolvedBy     = msg.sender;
        issue.resolvedAt     = block.timestamp;

        _changeBatchStatus(issue.batchId, finalBatchStatus);

        emit IssueSettled(
            issueId,
            issue.batchId,
            finalIssueStatus,
            settlementHash,
            msg.sender,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────

    function _changeBatchStatus(uint256 batchId, BatchStatus newStatus) internal {
        BatchStatus old = batches[batchId].status;
        batches[batchId].status = newStatus;
        emit BatchStatusChanged(batchId, old, newStatus, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View helpers — FE/backend gọi để query
    // ─────────────────────────────────────────────

    /// @notice Danh sách issueId của một batch
    function getIssuesByBatch(uint256 batchId)
        external view returns (uint256[] memory)
    {
        return batchIssues[batchId];
    }

    /// @notice Danh sách custodyUpdateId của một batch (timeline vận chuyển)
    function getCustodyLog(uint256 batchId)
        external view returns (uint256[] memory)
    {
        return batchCustodyLog[batchId];
    }

    /// @notice Trạng thái hiện tại của batch
    function getBatchStatus(uint256 batchId)
        external view returns (BatchStatus)
    {
        require(batches[batchId].exists, "getBatchStatus: batch not found");
        return batches[batchId].status;
    }
}
