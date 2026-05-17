// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  Counter
 * @notice Accountability infrastructure cho chuỗi cung ứng BlockTrace.
 *
 * Kiến trúc Plan → Execute → Log:
 *  - Dữ liệu nhạy cảm (ảnh, biên bản, video) lưu OFF-CHAIN (IPFS/Database).
 *  - On-chain chỉ giữ hash, CID, trạng thái, timestamp, actor.
 *  - Mọi state transition đều emit event để backend index và FE tái dựng timeline.
 *
 * Roles:
 *  - DEFAULT_ADMIN_ROLE : cấp/thu hồi mọi role khác; pause/unpause contract
 *  - PRODUCER_ROLE      : tạo batch (mint), neo metadataHash + metadataCID
 *  - DISTRIBUTOR_ROLE   : nhận custody, cập nhật mốc vận chuyển, báo issue, neo evidence
 *  - RETAILER_ROLE      : nhận custody cuối, xác nhận delivered, báo issue, neo evidence
 *  - INSPECTOR_ROLE     : mở issue, khóa batch sang UnderReview, neo evidence
 *  - RESOLVER_ROLE      : chốt settlement (cần xác nhận từ ít nhất 1 bên liên quan)
 *  - AUDITOR_ROLE       : chỉ đọc — dành cho auditor/regulator độc lập
 *
 * ═══════════════════════════════════════════════════════════════
 * CHANGELOG — đối chiếu Kịch_bản_UAT.md / Chính_sách_bảo_mật.md
 * ═══════════════════════════════════════════════════════════════
 *
 * [FIX-1] transferCustody  : bắt buộc `to` phải có DISTRIBUTOR hoặc RETAILER role;
 *                            thêm kiểm tra thứ tự custody Producer→Distributor→Retailer.
 * [FIX-2] updateCustody    : chỉ currentOwner của batch mới được ghi custody log.
 * [FIX-3] anchorEvidence   : không cho overwrite evidenceHash (non-repudiation).
 * [FIX-4] resolveIssue     : batch phải đang UnderReview trước khi chốt.
 * [FIX-5] resolveIssue     : batch chỉ → Cleared khi tất cả issue resolved (openIssueCount).
 * [ADD-1] Pausable          : admin pause toàn bộ hàm ghi trong trường hợp khẩn cấp.
 *                            (Chính_sách_bảo_mật.md §3)
 * [ADD-2] resolveIssue      : evidence phải được neo trước khi resolver chốt.
 *                            (Kịch_bản_UAT.md §3 — causal chain: evidence → resolution)
 * [ADD-3] confirmResolution : resolver cần ít nhất 1 xác nhận từ producer/distributor/retailer.
 *                            (Chính_sách_bảo_mật.md §6 — separation of duties)
 */
contract Counter is AccessControl, Pausable {

    // ─────────────────────────────────────────────
    //  Roles
    // ─────────────────────────────────────────────

    bytes32 public constant PRODUCER_ROLE    = keccak256("PRODUCER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE    = keccak256("RETAILER_ROLE");
    bytes32 public constant INSPECTOR_ROLE   = keccak256("INSPECTOR_ROLE");
    bytes32 public constant RESOLVER_ROLE    = keccak256("RESOLVER_ROLE");
    bytes32 public constant AUDITOR_ROLE     = keccak256("AUDITOR_ROLE");

    // ─────────────────────────────────────────────
    //  Enums
    // ─────────────────────────────────────────────

    enum BatchStatus {
        Minted,       // batch vừa được tạo bởi producer
        InTransit,    // đang trên đường vận chuyển
        Delivered,    // đã giao đến retailer/điểm cuối
        UnderReview,  // bị khóa do có issue
        Recalled,     // bị thu hồi
        Cleared       // issue đã giải quyết, lô được thông
    }

    enum IssueStatus {
        Open,         // vừa được mở
        UnderReview,  // đang thu thập chứng cứ
        Resolved,     // đã xử lý xong
        Recalled      // dẫn đến thu hồi lô
    }

    enum ResolutionType {
        None,          // chưa có quyết định
        Cleared,       // lô không có lỗi / lỗi nhỏ, thông qua
        Refund,        // hoàn tiền toàn phần
        RefundPartial, // hoàn tiền một phần
        Replaced,      // đổi hàng mới
        Recalled       // thu hồi toàn bộ lô
    }

    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────

    struct Batch {
        uint256     id;
        bytes32     metadataHash;   // SHA-256 hash metadata off-chain
        string      metadataCID;    // IPFS CID → FE fetch file JSON/PDF gốc
        address     producer;       // ví nhà sản xuất (nguồn gốc)
        address     currentOwner;   // đơn vị đang nắm giữ lô hàng
        uint256     createdAt;
        BatchStatus status;
        bool        exists;
        uint256     openIssueCount; // [FIX-5] số issue chưa settled
    }

    struct CustodyUpdate {
        uint256 batchId;
        address actor;       // distributor hoặc retailer
        bytes32 updateHash;  // hash dữ liệu custody off-chain (GPS, nhiệt độ...)
        uint256 timestamp;
        string  note;        // "Rời kho HCM", "Đến DC Hà Nội"...
    }

    struct Issue {
        uint256        id;
        uint256        batchId;
        bytes32        issueHash;            // hash mô tả lỗi off-chain
        string         issueType;            // "TEMPERATURE_VIOLATION", "DAMAGED"...
        address        reporter;
        uint256        reportedAt;
        IssueStatus    status;
        bytes32        evidenceHash;         // hash chứng cứ off-chain (ảnh, biên bản...)
        bytes32        settlementHash;       // hash phương án xử lý off-chain
        ResolutionType resolutionType;       // Refund / Replaced / Recalled...
        address        resolvedBy;
        uint256        resolvedAt;
        bool           stakeholderConfirmed; // [ADD-3] xác nhận từ bên liên quan
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    uint256 private _nextBatchId;
    uint256 private _nextIssueId;
    uint256 private _nextCustodyId;

    mapping(uint256 => Batch)         public batches;
    mapping(uint256 => Issue)         public issues;
    mapping(uint256 => CustodyUpdate) public custodyUpdates;

    mapping(uint256 => uint256[]) public batchIssues;      // batchId → issueIds
    mapping(uint256 => uint256[]) public batchCustodyLog;  // batchId → custodyUpdateIds

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    // --- Batch ---
    event BatchCreated(
        uint256 indexed batchId,
        bytes32         metadataHash,
        string          metadataCID,
        address indexed producer,
        uint256         createdAt
    );
    event BatchStatusChanged(
        uint256 indexed batchId,
        BatchStatus     oldStatus,
        BatchStatus     newStatus,
        address indexed changedBy,
        uint256         timestamp
    );
    event CustodyTransferred(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        uint256         timestamp
    );

    // --- Custody ---
    event CustodyUpdated(
        uint256 indexed custodyId,
        uint256 indexed batchId,
        address indexed actor,
        bytes32         updateHash,
        string          note,
        uint256         timestamp
    );

    // --- Issue ---
    event IssueOpened(
        uint256 indexed issueId,
        uint256 indexed batchId,
        bytes32         issueHash,
        string          issueType,
        address indexed reporter,
        uint256         reportedAt
    );
    event EvidenceAnchored(
        uint256 indexed issueId,
        bytes32         evidenceHash,
        address indexed anchoredBy,
        uint256         timestamp
    );
    /// @notice [ADD-3] Một bên liên quan xác nhận đồng ý phương án
    event ResolutionConfirmed(
        uint256 indexed issueId,
        address indexed confirmedBy,
        uint256         timestamp
    );
    event IssueSettled(
        uint256 indexed issueId,
        uint256 indexed batchId,
        IssueStatus     finalStatus,
        ResolutionType  resolutionType,
        bytes32         settlementHash,
        address indexed resolvedBy,
        uint256         resolvedAt
    );

    // --- Admin --- [ADD-1]
    event ContractPaused(address indexed by, uint256 timestamp);
    event ContractUnpaused(address indexed by, uint256 timestamp);

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─────────────────────────────────────────────
    //  [ADD-1] Pause / Unpause
    // ─────────────────────────────────────────────

    /**
     * @notice Dừng toàn bộ hàm ghi trong trường hợp khẩn cấp.
     * @dev Chỉ DEFAULT_ADMIN_ROLE. Phù hợp Chính_sách_bảo_mật.md §3:
     *      "Pausable cho các hàm ghi trạng thái; pause/unpause chỉ admin multisig."
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  PLAN: Producer mint batch
    // ─────────────────────────────────────────────

    /**
     * @notice Mint batch mới — neo metadataHash và metadataCID lên chain.
     * @param metadataHash Hash SHA-256 của file metadata off-chain.
     * @param metadataCID  IPFS CID dẫn đến file JSON/PDF gốc.
     * @return batchId     ID của batch vừa tạo.
     */
    function createBatch(bytes32 metadataHash, string calldata metadataCID)
        external
        onlyRole(PRODUCER_ROLE)
        whenNotPaused
        returns (uint256 batchId)
    {
        require(metadataHash != bytes32(0),    "createBatch: metadataHash required");
        require(bytes(metadataCID).length > 0, "createBatch: metadataCID required");

        batchId = _nextBatchId++;

        batches[batchId] = Batch({
            id:             batchId,
            metadataHash:   metadataHash,
            metadataCID:    metadataCID,
            producer:       msg.sender,
            currentOwner:   msg.sender,
            createdAt:      block.timestamp,
            status:         BatchStatus.Minted,
            exists:         true,
            openIssueCount: 0
        });

        emit BatchCreated(batchId, metadataHash, metadataCID, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE: Chuyển custody
    // ─────────────────────────────────────────────

    /**
     * @notice Chuyển quyền nắm giữ batch sang đơn vị tiếp theo.
     * @param batchId  ID batch cần chuyển.
     * @param to       Ví của đơn vị nhận.
     *
     * @dev [FIX-1] `to` phải có DISTRIBUTOR hoặc RETAILER role.
     *      [FIX-1] Thứ tự custody:
     *        Minted    → chỉ được chuyển đến DISTRIBUTOR
     *        InTransit → chuyển đến DISTRIBUTOR khác hoặc RETAILER
     *        Delivered → không được chuyển tiếp (điểm cuối chuỗi)
     */
    function transferCustody(uint256 batchId, address to)
        external
        whenNotPaused
    {
        Batch storage batch = batches[batchId];

        require(batch.exists,                     "transferCustody: batch not found");
        require(batch.currentOwner == msg.sender, "transferCustody: caller is not current owner");
        require(to != address(0),                 "transferCustody: invalid recipient");
        require(
            hasRole(DISTRIBUTOR_ROLE, to) || hasRole(RETAILER_ROLE, to),
            "transferCustody: recipient must be distributor or retailer"
        );

        // [FIX-1] kiểm tra thứ tự custody theo luồng Producer→Distributor→Retailer
        if (batch.status == BatchStatus.Minted) {
            require(
                hasRole(DISTRIBUTOR_ROLE, to),
                "transferCustody: from Minted, must transfer to distributor first"
            );
        } else if (batch.status == BatchStatus.InTransit) {
            // Distributor chuyển tiếp: cho Distributor khác hoặc Retailer — OK
        } else if (batch.status == BatchStatus.Delivered) {
            revert("transferCustody: batch already delivered, cannot transfer further");
        } else {
            revert("transferCustody: batch not transferable in current status");
        }

        address previousOwner = batch.currentOwner;
        batch.currentOwner = to;

        if (hasRole(DISTRIBUTOR_ROLE, to)) {
            _changeBatchStatus(batchId, BatchStatus.InTransit);
        } else {
            _changeBatchStatus(batchId, BatchStatus.Delivered);
        }

        emit CustodyTransferred(batchId, previousOwner, to, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE: Cập nhật mốc vận chuyển
    // ─────────────────────────────────────────────

    /**
     * @notice Ghi lại một mốc custody/vận chuyển (nhiệt độ, GPS, handover...).
     * @param batchId    ID batch đang vận chuyển.
     * @param updateHash Hash dữ liệu IoT/logistics off-chain.
     * @param note       Mô tả ngắn trên timeline.
     *
     * @dev [FIX-2] Chỉ currentOwner của batch mới được ghi log.
     */
    function updateCustody(
        uint256 batchId,
        bytes32 updateHash,
        string calldata note
    )
        external
        whenNotPaused
    {
        require(
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(RETAILER_ROLE,    msg.sender),
            "updateCustody: caller is not distributor or retailer"
        );

        Batch storage batch = batches[batchId];
        require(batch.exists, "updateCustody: batch not found");

        // [FIX-2] chỉ người đang nắm giữ batch mới được ghi log
        require(
            batch.currentOwner == msg.sender,
            "updateCustody: caller is not current owner of batch"
        );
        require(
            batch.status == BatchStatus.InTransit ||
            batch.status == BatchStatus.Delivered,
            "updateCustody: batch not active"
        );
        require(updateHash != bytes32(0), "updateCustody: updateHash required");
        require(bytes(note).length > 0,   "updateCustody: note required");

        uint256 custodyId = _nextCustodyId++;

        custodyUpdates[custodyId] = CustodyUpdate({
            batchId:    batchId,
            actor:      msg.sender,
            updateHash: updateHash,
            timestamp:  block.timestamp,
            note:       note
        });

        batchCustodyLog[batchId].push(custodyId);

        emit CustodyUpdated(custodyId, batchId, msg.sender, updateHash, note, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  PLAN: Mở issue
    // ─────────────────────────────────────────────

    /**
     * @notice Mở issue và khóa batch sang UnderReview.
     * @param batchId   ID batch có bất thường.
     * @param issueHash Hash mô tả issue off-chain.
     * @param issueType Phân loại lỗi: "TEMPERATURE_VIOLATION", "DAMAGED"...
     * @return issueId  ID của issue vừa tạo.
     */
    function reportIssue(
        uint256 batchId,
        bytes32 issueHash,
        string calldata issueType
    )
        external
        whenNotPaused
        returns (uint256 issueId)
    {
        require(
            hasRole(INSPECTOR_ROLE,   msg.sender) ||
            hasRole(RETAILER_ROLE,    msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender),
            "reportIssue: caller is not inspector, retailer, or distributor"
        );

        require(batches[batchId].exists, "reportIssue: batch not found");
        require(
            batches[batchId].status != BatchStatus.Recalled &&
            batches[batchId].status != BatchStatus.UnderReview,
            "reportIssue: batch not active"
        );
        require(issueHash != bytes32(0),     "reportIssue: issueHash required");
        require(bytes(issueType).length > 0, "reportIssue: issueType required");

        issueId = _nextIssueId++;

        issues[issueId] = Issue({
            id:                   issueId,
            batchId:              batchId,
            issueHash:            issueHash,
            issueType:            issueType,
            reporter:             msg.sender,
            reportedAt:           block.timestamp,
            status:               IssueStatus.Open,
            evidenceHash:         bytes32(0),
            settlementHash:       bytes32(0),
            resolutionType:       ResolutionType.None,
            resolvedBy:           address(0),
            resolvedAt:           0,
            stakeholderConfirmed: false
        });

        batchIssues[batchId].push(issueId);

        // [FIX-5] tăng bộ đếm issue đang mở
        batches[batchId].openIssueCount += 1;

        _changeBatchStatus(batchId, BatchStatus.UnderReview);

        emit IssueOpened(issueId, batchId, issueHash, issueType, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE: Neo hash chứng cứ off-chain
    // ─────────────────────────────────────────────

    /**
     * @notice Neo hash chứng cứ off-chain (ảnh lỗi, biên bản kiểm định, video...).
     * @param issueId      ID issue đang xử lý.
     * @param evidenceHash Hash SHA-256 của gói chứng cứ off-chain lưu trên IPFS.
     *
     * @dev [FIX-3] Không cho phép overwrite evidenceHash đã set — non-repudiation.
     */
    function anchorEvidence(uint256 issueId, bytes32 evidenceHash)
        external
        whenNotPaused
    {
        require(
            hasRole(INSPECTOR_ROLE,   msg.sender) ||
            hasRole(RETAILER_ROLE,    msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender),
            "anchorEvidence: caller is not inspector, retailer, or distributor"
        );

        Issue storage issue = issues[issueId];

        require(issue.reportedAt != 0, "anchorEvidence: issue not found");
        require(
            issue.status == IssueStatus.Open ||
            issue.status == IssueStatus.UnderReview,
            "anchorEvidence: issue not open"
        );
        require(evidenceHash != bytes32(0), "anchorEvidence: evidenceHash required");

        // [FIX-3] không ghi đè evidenceHash đã tồn tại
        require(
            issue.evidenceHash == bytes32(0),
            "anchorEvidence: evidence already anchored"
        );

        issue.evidenceHash = evidenceHash;
        issue.status       = IssueStatus.UnderReview;

        emit EvidenceAnchored(issueId, evidenceHash, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE: Xác nhận phương án xử lý  [ADD-3]
    // ─────────────────────────────────────────────

    /**
     * @notice Bên liên quan xác nhận đồng ý phương án trước khi resolver chốt.
     * @param issueId ID issue cần xác nhận.
     *
     * @dev Phù hợp Chính_sách_bảo_mật.md §6:
     *      "approveResolution → RESOLVER_ROLE cùng ít nhất một xác nhận từ bên liên quan".
     *
     *      Separation of duties: chỉ PRODUCER / DISTRIBUTOR / RETAILER được xác nhận.
     *      Inspector và Resolver không được self-approve.
     *
     *      MVP: một cờ boolean — bất kỳ stakeholder nào xác nhận là đủ điều kiện cho
     *      resolver chốt. Production nâng lên multi-sig hoặc threshold voting.
     */
    function confirmResolution(uint256 issueId)
        external
        whenNotPaused
    {
        require(
            hasRole(PRODUCER_ROLE,    msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(RETAILER_ROLE,    msg.sender),
            "confirmResolution: caller must be producer, distributor, or retailer"
        );

        Issue storage issue = issues[issueId];

        require(issue.reportedAt != 0, "confirmResolution: issue not found");
        require(
            issue.status == IssueStatus.Open ||
            issue.status == IssueStatus.UnderReview,
            "confirmResolution: issue already settled"
        );
        require(
            issue.evidenceHash != bytes32(0),
            "confirmResolution: evidence must be anchored before confirming"
        );
        require(
            !issue.stakeholderConfirmed,
            "confirmResolution: already confirmed"
        );

        issue.stakeholderConfirmed = true;

        emit ResolutionConfirmed(issueId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  LOG: Resolver chốt settlement
    // ─────────────────────────────────────────────

    /**
     * @notice Chốt phương án xử lý issue và cập nhật trạng thái batch.
     * @param issueId        ID issue cần chốt.
     * @param settlementHash Hash phương án xử lý off-chain (biên bản thỏa thuận...).
     * @param resolution     Cleared / Refund / RefundPartial / Replaced / Recalled.
     *
     * @dev Chỉ RESOLVER_ROLE.
     *
     * [FIX-4] Batch phải đang UnderReview.
     * [FIX-5] Batch chỉ → Cleared khi openIssueCount == 0.
     * [ADD-2] evidenceHash phải được neo trước (Kịch_bản_UAT.md §3 causal chain).
     * [ADD-3] stakeholderConfirmed phải true (Chính_sách_bảo_mật.md §6).
     *
     * Recalled override: batch chuyển ngay bất kể còn issue nào khác đang mở.
     */
    function resolveIssue(
        uint256        issueId,
        bytes32        settlementHash,
        ResolutionType resolution
    )
        external
        onlyRole(RESOLVER_ROLE)
        whenNotPaused
    {
        require(resolution != ResolutionType.None, "resolveIssue: resolution required");

        Issue storage issue = issues[issueId];

        require(issue.reportedAt != 0, "resolveIssue: issue not found");
        require(
            issue.status != IssueStatus.Resolved &&
            issue.status != IssueStatus.Recalled,
            "resolveIssue: already settled"
        );
        require(settlementHash != bytes32(0), "resolveIssue: settlementHash required");

        // [FIX-4] batch phải đang bị khóa
        require(
            batches[issue.batchId].status == BatchStatus.UnderReview,
            "resolveIssue: batch is not under review"
        );

        // [ADD-2] evidence phải tồn tại trước khi chốt
        require(
            issue.evidenceHash != bytes32(0),
            "resolveIssue: evidence must be anchored before resolving"
        );

        // [ADD-3] cần ít nhất một xác nhận từ bên liên quan
        require(
            issue.stakeholderConfirmed,
            "resolveIssue: stakeholder confirmation required before resolving"
        );

        bool recall = (resolution == ResolutionType.Recalled);

        IssueStatus finalIssueStatus = recall ? IssueStatus.Recalled : IssueStatus.Resolved;

        issue.status         = finalIssueStatus;
        issue.settlementHash = settlementHash;
        issue.resolutionType = resolution;
        issue.resolvedBy     = msg.sender;
        issue.resolvedAt     = block.timestamp;

        // [FIX-5] giảm bộ đếm issue còn mở
        batches[issue.batchId].openIssueCount -= 1;

        if (recall) {
            // Recalled: chuyển batch ngay, không chờ issue khác
            _changeBatchStatus(issue.batchId, BatchStatus.Recalled);
        } else if (batches[issue.batchId].openIssueCount == 0) {
            // Cleared: mở khóa batch khi tất cả issue đã resolved
            _changeBatchStatus(issue.batchId, BatchStatus.Cleared);
        }
        // Còn issue khác đang mở → batch giữ nguyên UnderReview

        emit IssueSettled(
            issueId,
            issue.batchId,
            finalIssueStatus,
            resolution,
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
    //  View helpers
    // ─────────────────────────────────────────────

    /// @notice Trạng thái hiện tại của batch
    function getBatchStatus(uint256 batchId)
        external view returns (BatchStatus)
    {
        require(batches[batchId].exists, "getBatchStatus: batch not found");
        return batches[batchId].status;
    }

    /// @notice Đơn vị đang nắm giữ batch hiện tại
    function getCurrentOwner(uint256 batchId)
        external view returns (address)
    {
        require(batches[batchId].exists, "getCurrentOwner: batch not found");
        return batches[batchId].currentOwner;
    }

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

    /// @notice Số issue chưa settled trên một batch
    function getOpenIssueCount(uint256 batchId)
        external view returns (uint256)
    {
        require(batches[batchId].exists, "getOpenIssueCount: batch not found");
        return batches[batchId].openIssueCount;
    }

    /// @notice Kiểm tra issue đã có xác nhận từ bên liên quan chưa  [ADD-3]
    function isResolutionConfirmed(uint256 issueId)
        external view returns (bool)
    {
        require(issues[issueId].reportedAt != 0, "isResolutionConfirmed: issue not found");
        return issues[issueId].stakeholderConfirmed;
    }
}
