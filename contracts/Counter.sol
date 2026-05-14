// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Counter {
    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────

    struct Batch {
        uint256 id;
        string  description;
        address creator;
        uint256 createdAt;
        bool    exists;
    }

    struct Issue {
        uint256 id;
        uint256 batchId;
        string  description;
        address reporter;
        uint256 reportedAt;
        bool    resolved;
        address resolvedBy;
        uint256 resolvedAt;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    uint public x;

    uint256 private _nextBatchId;
    uint256 private _nextIssueId;

    mapping(uint256 => Batch)  public batches;
    mapping(uint256 => Issue)  public issues;

    // batchId → list of issueIds
    mapping(uint256 => uint256[]) public batchIssues;

    // ─────────────────────────────────────────────
    //  Events  (dùng cho FE subscribe)
    // ─────────────────────────────────────────────

    event Increment(uint by);

    /// @notice Phát ra khi một batch mới được tạo
    /// @param batchId      ID của batch
    /// @param description  Mô tả batch
    /// @param creator      Địa chỉ ví tạo batch
    /// @param createdAt    Timestamp tạo (block.timestamp)
    event BatchCreated(
        uint256 indexed batchId,
        string          description,
        address indexed creator,
        uint256         createdAt
    );

    /// @notice Phát ra khi có issue được báo cáo
    /// @param issueId      ID của issue
    /// @param batchId      Batch liên quan
    /// @param description  Mô tả lỗi
    /// @param reporter     Địa chỉ ví báo cáo
    /// @param reportedAt   Timestamp báo cáo
    event IssueReported(
        uint256 indexed issueId,
        uint256 indexed batchId,
        string          description,
        address indexed reporter,
        uint256         reportedAt
    );

    /// @notice Phát ra khi issue được giải quyết
    /// @param issueId     ID của issue
    /// @param batchId     Batch liên quan
    /// @param resolvedBy  Địa chỉ ví giải quyết
    /// @param resolvedAt  Timestamp giải quyết
    event IssueResolved(
        uint256 indexed issueId,
        uint256 indexed batchId,
        address indexed resolvedBy,
        uint256         resolvedAt
    );

    // ─────────────────────────────────────────────
    //  Counter (giữ nguyên logic cũ)
    // ─────────────────────────────────────────────

    function inc() public {
        x++;
        emit Increment(1);
    }

    function incBy(uint by) public {
        require(by > 0, "incBy: increment should be positive");
        x += by;
        emit Increment(by);
    }

    // ─────────────────────────────────────────────
    //  Batch
    // ─────────────────────────────────────────────

    /// @notice Tạo một batch mới
    /// @param description Mô tả batch (VD: mã lô hàng, tên sản phẩm...)
    /// @return batchId ID của batch vừa tạo
    function createBatch(string calldata description)
        external
        returns (uint256 batchId)
    {
        require(bytes(description).length > 0, "createBatch: description required");

        batchId = _nextBatchId++;

        batches[batchId] = Batch({
            id:          batchId,
            description: description,
            creator:     msg.sender,
            createdAt:   block.timestamp,
            exists:      true
        });

        emit BatchCreated(batchId, description, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  Issue
    // ─────────────────────────────────────────────

    /// @notice Báo cáo một vấn đề cho batch
    /// @param batchId    ID batch cần báo cáo
    /// @param description Mô tả lỗi / vấn đề
    /// @return issueId ID của issue vừa tạo
    function reportIssue(uint256 batchId, string calldata description)
        external
        returns (uint256 issueId)
    {
        require(batches[batchId].exists, "reportIssue: batch not found");
        require(bytes(description).length > 0, "reportIssue: description required");

        issueId = _nextIssueId++;

        issues[issueId] = Issue({
            id:          issueId,
            batchId:     batchId,
            description: description,
            reporter:    msg.sender,
            reportedAt:  block.timestamp,
            resolved:    false,
            resolvedBy:  address(0),
            resolvedAt:  0
        });

        batchIssues[batchId].push(issueId);

        emit IssueReported(issueId, batchId, description, msg.sender, block.timestamp);
    }

    /// @notice Đánh dấu một issue đã được giải quyết
    /// @param issueId ID của issue cần resolve
    function resolveIssue(uint256 issueId) external {
        Issue storage issue = issues[issueId];

        require(issue.reportedAt != 0,  "resolveIssue: issue not found");
        require(!issue.resolved,        "resolveIssue: already resolved");

        issue.resolved   = true;
        issue.resolvedBy = msg.sender;
        issue.resolvedAt = block.timestamp;

        emit IssueResolved(issueId, issue.batchId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View helpers (FE gọi để query data)
    // ─────────────────────────────────────────────

    /// @notice Trả về danh sách issueId của một batch
    function getIssuesByBatch(uint256 batchId)
        external
        view
        returns (uint256[] memory)
    {
        return batchIssues[batchId];
    }
}
