// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Counter} from "./Counter.sol";
import {Test}    from "forge-std/Test.sol";

contract CounterTest is Test {

    Counter bt;

    address admin       = makeAddr("admin");
    address producer    = makeAddr("producer");
    address distributor = makeAddr("distributor");
    address retailer    = makeAddr("retailer");    // [+] mới
    address inspector   = makeAddr("inspector");
    address resolver    = makeAddr("resolver");
    address stranger    = makeAddr("stranger");

    bytes32 constant META_HASH       = keccak256("metadata-ipfs-cid");
    bytes32 constant UPDATE_HASH     = keccak256("custody-update-data");
    bytes32 constant ISSUE_HASH      = keccak256("issue-description-data");
    bytes32 constant EVIDENCE_HASH   = keccak256("evidence-photos-data");
    bytes32 constant SETTLEMENT_HASH = keccak256("settlement-plan-data");

    // ─────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────

    function setUp() public {
        vm.prank(admin);
        bt = new Counter(admin);

        vm.startPrank(admin);
        bt.grantRole(bt.PRODUCER_ROLE(),    producer);
        bt.grantRole(bt.DISTRIBUTOR_ROLE(), distributor);
        bt.grantRole(bt.RETAILER_ROLE(),    retailer);    // [+] mới
        bt.grantRole(bt.INSPECTOR_ROLE(),   inspector);
        bt.grantRole(bt.RESOLVER_ROLE(),    resolver);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────

    function _createBatch() internal returns (uint256 batchId) {
        vm.prank(producer);
        batchId = bt.createBatch(META_HASH);
    }

    function _createBatchAndIssue() internal returns (uint256 batchId, uint256 issueId) {
        batchId = _createBatch();
        vm.prank(inspector);
        issueId = bt.reportIssue(batchId, ISSUE_HASH);
    }

    // ─────────────────────────────────────────────
    //  ACCESS CONTROL
    // ─────────────────────────────────────────────

    function test_AccessControl_CreateBatch_Unauthorized() public {
        vm.prank(stranger);
        vm.expectRevert();
        bt.createBatch(META_HASH);
    }

    function test_AccessControl_UpdateCustody_Unauthorized() public {
        uint256 batchId = _createBatch();
        vm.prank(stranger);
        vm.expectRevert();
        bt.updateCustody(batchId, UPDATE_HASH, "Left warehouse");
    }

    function test_AccessControl_ReportIssue_Unauthorized() public {
        uint256 batchId = _createBatch();
        // stranger không có bất kỳ role nào trong 3 role được phép → revert
        vm.prank(stranger);
        vm.expectRevert();
        bt.reportIssue(batchId, ISSUE_HASH);
    }

    // [+] Kiểm tra retailer và distributor cũng được phép báo issue
    function test_ReportIssue_ByRetailer() public {
        uint256 batchId = _createBatch();
        vm.prank(retailer);
        uint256 issueId = bt.reportIssue(batchId, ISSUE_HASH);
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.UnderReview));
        (,,,address rep,,,,,, ) = bt.issues(issueId);
        assertEq(rep, retailer);
    }

    function test_ReportIssue_ByDistributor() public {
        uint256 batchId = _createBatch();
        vm.prank(distributor);
        uint256 issueId = bt.reportIssue(batchId, ISSUE_HASH);
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.UnderReview));
        (,,,address rep,,,,,, ) = bt.issues(issueId);
        assertEq(rep, distributor);
    }

    function test_AccessControl_AnchorEvidence_Unauthorized() public {
        (, uint256 issueId) = _createBatchAndIssue();
        // stranger không có bất kỳ role nào trong 3 role được phép → revert
        vm.prank(stranger);
        vm.expectRevert();
        bt.anchorEvidence(issueId, EVIDENCE_HASH);
    }

    // [+] Kiểm tra retailer và distributor cũng được phép neo evidence
    function test_AnchorEvidence_ByRetailer() public {
        (, uint256 issueId) = _createBatchAndIssue();
        vm.prank(retailer);
        bt.anchorEvidence(issueId, EVIDENCE_HASH);
        (,,,,, Counter.IssueStatus status, bytes32 evHash,,,) = bt.issues(issueId);
        assertEq(evHash, EVIDENCE_HASH);
        assertEq(uint8(status), uint8(Counter.IssueStatus.UnderReview));
    }

    function test_AnchorEvidence_ByDistributor() public {
        (, uint256 issueId) = _createBatchAndIssue();
        vm.prank(distributor);
        bt.anchorEvidence(issueId, EVIDENCE_HASH);
        (,,,,, Counter.IssueStatus status, bytes32 evHash,,,) = bt.issues(issueId);
        assertEq(evHash, EVIDENCE_HASH);
        assertEq(uint8(status), uint8(Counter.IssueStatus.UnderReview));
    }

    function test_AccessControl_ResolveIssue_Unauthorized() public {
        (, uint256 issueId) = _createBatchAndIssue();
        vm.prank(stranger);
        vm.expectRevert();
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);
    }

    // ─────────────────────────────────────────────
    //  CREATE BATCH
    // ─────────────────────────────────────────────

    function test_CreateBatch_Success() public {
        uint256 batchId = _createBatch();

        (
            uint256 id,
            bytes32 metaHash,
            address prod,
            uint256 createdAt,
            Counter.BatchStatus status,
            bool exists
        ) = bt.batches(batchId);

        assertEq(id, 0);
        assertEq(metaHash, META_HASH);
        assertEq(prod, producer);
        assertGt(createdAt, 0);
        assertEq(uint8(status), uint8(Counter.BatchStatus.Active));
        assertTrue(exists);
    }

    function test_CreateBatch_ZeroHash() public {
        vm.prank(producer);
        vm.expectRevert("createBatch: metadataHash required");
        bt.createBatch(bytes32(0));
    }

    function test_CreateBatch_EmitsEvent() public {
        vm.expectEmit(true, false, true, true);
        emit Counter.BatchCreated(0, META_HASH, producer, block.timestamp);
        vm.prank(producer);
        bt.createBatch(META_HASH);
    }

    function test_CreateBatch_IncrementId() public {
        vm.startPrank(producer);
        uint256 id0 = bt.createBatch(keccak256("meta0"));
        uint256 id1 = bt.createBatch(keccak256("meta1"));
        uint256 id2 = bt.createBatch(keccak256("meta2"));
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    // ─────────────────────────────────────────────
    //  UPDATE CUSTODY
    // ─────────────────────────────────────────────

    function test_UpdateCustody_Success() public {
        uint256 batchId = _createBatch();

        vm.prank(distributor);
        bt.updateCustody(batchId, UPDATE_HASH, "Left HCM warehouse");

        uint256[] memory log = bt.getCustodyLog(batchId);
        assertEq(log.length, 1);

        (
            uint256 bid,
            address actor,
            bytes32 updHash,
            uint256 ts,
            string memory note
        ) = bt.custodyUpdates(log[0]);

        assertEq(bid, batchId);
        assertEq(actor, distributor);
        assertEq(updHash, UPDATE_HASH);
        assertGt(ts, 0);
        assertEq(note, "Left HCM warehouse");
    }

    function test_UpdateCustody_BatchNotFound() public {
        vm.prank(distributor);
        vm.expectRevert("updateCustody: batch not found");
        bt.updateCustody(999, UPDATE_HASH, "note");
    }

    function test_UpdateCustody_BatchNotActive() public {
        (uint256 batchId,) = _createBatchAndIssue();

        vm.prank(distributor);
        vm.expectRevert("updateCustody: batch not active");
        bt.updateCustody(batchId, UPDATE_HASH, "note");
    }

    function test_UpdateCustody_ZeroHash() public {
        uint256 batchId = _createBatch();

        vm.prank(distributor);
        vm.expectRevert("updateCustody: updateHash required");
        bt.updateCustody(batchId, bytes32(0), "note");
    }

    function test_UpdateCustody_EmptyNote() public {
        uint256 batchId = _createBatch();

        vm.prank(distributor);
        vm.expectRevert("updateCustody: note required");
        bt.updateCustody(batchId, UPDATE_HASH, "");
    }

    function test_UpdateCustody_EmitsEvent() public {
        uint256 batchId = _createBatch();

        vm.expectEmit(true, true, true, true);
        emit Counter.CustodyUpdated(0, batchId, distributor, UPDATE_HASH, "Left HCM warehouse", block.timestamp);

        vm.prank(distributor);
        bt.updateCustody(batchId, UPDATE_HASH, "Left HCM warehouse");
    }

    function test_UpdateCustody_MultipleStops() public {
        uint256 batchId = _createBatch();

        vm.startPrank(distributor);
        bt.updateCustody(batchId, keccak256("stop1"), "Left HCM warehouse");
        bt.updateCustody(batchId, keccak256("stop2"), "Arrived Hanoi DC");
        bt.updateCustody(batchId, keccak256("stop3"), "Delivered to retailer");
        vm.stopPrank();

        uint256[] memory log = bt.getCustodyLog(batchId);
        assertEq(log.length, 3);
    }

    // ─────────────────────────────────────────────
    //  REPORT ISSUE
    // ─────────────────────────────────────────────

    function test_ReportIssue_Success() public {
        (uint256 batchId, uint256 issueId) = _createBatchAndIssue();

        // Issue struct: id, batchId, issueHash, reporter, reportedAt, status,
        //               evidenceHash, settlementHash, resolvedBy, resolvedAt  (10 fields)
        (
            uint256 id,
            uint256 bid,
            bytes32 iHash,
            address rep,
            uint256 reportedAt,
            Counter.IssueStatus status,
            bytes32 evHash,
            bytes32 setHash,
            address resolvedBy,
            uint256 resolvedAt
        ) = bt.issues(issueId);

        assertEq(id, 0);
        assertEq(bid, batchId);
        assertEq(iHash, ISSUE_HASH);
        assertEq(rep, inspector);
        assertGt(reportedAt, 0);
        assertEq(uint8(status), uint8(Counter.IssueStatus.Open));
        assertEq(evHash, bytes32(0));
        assertEq(setHash, bytes32(0));
        assertEq(resolvedBy, address(0));
        assertEq(resolvedAt, 0);
    }

    function test_ReportIssue_LocksBatchToUnderReview() public {
        (uint256 batchId,) = _createBatchAndIssue();
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.UnderReview));
    }

    function test_ReportIssue_BatchNotFound() public {
        vm.prank(inspector);
        vm.expectRevert("reportIssue: batch not found");
        bt.reportIssue(999, ISSUE_HASH);
    }

    function test_ReportIssue_BatchNotActive() public {
        (uint256 batchId,) = _createBatchAndIssue();

        vm.prank(inspector);
        vm.expectRevert("reportIssue: batch not active");
        bt.reportIssue(batchId, ISSUE_HASH);
    }

    function test_ReportIssue_ZeroHash() public {
        uint256 batchId = _createBatch();

        vm.prank(inspector);
        vm.expectRevert("reportIssue: issueHash required");
        bt.reportIssue(batchId, bytes32(0));
    }

    function test_ReportIssue_EmitsIssueOpened() public {
        uint256 batchId = _createBatch();

        vm.expectEmit(true, true, true, true);
        emit Counter.IssueOpened(0, batchId, ISSUE_HASH, inspector, block.timestamp);

        vm.prank(inspector);
        bt.reportIssue(batchId, ISSUE_HASH);
    }

    function test_ReportIssue_EmitsBatchStatusChanged() public {
        uint256 batchId = _createBatch();

        vm.expectEmit(true, false, false, true);
        emit Counter.BatchStatusChanged(
            batchId,
            Counter.BatchStatus.Active,
            Counter.BatchStatus.UnderReview,
            inspector,
            block.timestamp
        );

        vm.prank(inspector);
        bt.reportIssue(batchId, ISSUE_HASH);
    }

    function test_ReportIssue_AppearsInBatchIssues() public {
        uint256 batchId = _createBatch();

        vm.prank(inspector);
        uint256 i0 = bt.reportIssue(batchId, keccak256("issue0"));

        vm.prank(resolver);
        bt.resolveIssue(i0, SETTLEMENT_HASH, false);

        vm.prank(producer);
        uint256 batchId2 = bt.createBatch(keccak256("meta2"));

        vm.prank(inspector);
        bt.reportIssue(batchId2, keccak256("issue1"));

        uint256[] memory ids = bt.getIssuesByBatch(batchId);
        assertEq(ids.length, 1);
        assertEq(ids[0], i0);
    }

    // ─────────────────────────────────────────────
    //  ANCHOR EVIDENCE
    // ─────────────────────────────────────────────

    function test_AnchorEvidence_Success() public {
        (, uint256 issueId) = _createBatchAndIssue();

        vm.prank(inspector);
        bt.anchorEvidence(issueId, EVIDENCE_HASH);

        // 10 fields: id, batchId, issueHash, reporter, reportedAt,
        //            status, evidenceHash, settlementHash, resolvedBy, resolvedAt
        (,,,,, Counter.IssueStatus status, bytes32 evHash,,,) = bt.issues(issueId);

        assertEq(evHash, EVIDENCE_HASH);
        assertEq(uint8(status), uint8(Counter.IssueStatus.UnderReview));
    }

    function test_AnchorEvidence_IssueNotFound() public {
        vm.prank(inspector);
        vm.expectRevert("anchorEvidence: issue not found");
        bt.anchorEvidence(999, EVIDENCE_HASH);
    }

    function test_AnchorEvidence_ZeroHash() public {
        (, uint256 issueId) = _createBatchAndIssue();

        vm.prank(inspector);
        vm.expectRevert("anchorEvidence: evidenceHash required");
        bt.anchorEvidence(issueId, bytes32(0));
    }

    function test_AnchorEvidence_AfterResolved() public {
        (, uint256 issueId) = _createBatchAndIssue();

        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);

        vm.prank(inspector);
        vm.expectRevert("anchorEvidence: issue not open");
        bt.anchorEvidence(issueId, EVIDENCE_HASH);
    }

    function test_AnchorEvidence_EmitsEvent() public {
        (, uint256 issueId) = _createBatchAndIssue();

        vm.expectEmit(true, false, true, true);
        emit Counter.EvidenceAnchored(issueId, EVIDENCE_HASH, inspector, block.timestamp);

        vm.prank(inspector);
        bt.anchorEvidence(issueId, EVIDENCE_HASH);
    }

    // ─────────────────────────────────────────────
    //  RESOLVE ISSUE
    // ─────────────────────────────────────────────

    function test_ResolveIssue_Cleared() public {
        (uint256 batchId, uint256 issueId) = _createBatchAndIssue();

        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);

        // 10 fields: id, batchId, issueHash, reporter, reportedAt,
        //            status, evidenceHash, settlementHash, resolvedBy, resolvedAt
        (,,,,, Counter.IssueStatus iStatus,, bytes32 setHash, address resolvedBy, uint256 resolvedAt)
            = bt.issues(issueId);

        assertEq(uint8(iStatus), uint8(Counter.IssueStatus.Resolved));
        assertEq(setHash, SETTLEMENT_HASH);
        assertEq(resolvedBy, resolver);
        assertGt(resolvedAt, 0);
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.Cleared));
    }

    function test_ResolveIssue_Recalled() public {
        (uint256 batchId, uint256 issueId) = _createBatchAndIssue();

        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, true);

        // 10 fields — chỉ lấy status ở vị trí 6 (index 5)
        (,,,,, Counter.IssueStatus iStatus,,,,) = bt.issues(issueId);

        assertEq(uint8(iStatus), uint8(Counter.IssueStatus.Recalled));
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.Recalled));
    }

    function test_ResolveIssue_NotFound() public {
        vm.prank(resolver);
        vm.expectRevert("resolveIssue: issue not found");
        bt.resolveIssue(999, SETTLEMENT_HASH, false);
    }

    function test_ResolveIssue_AlreadySettled() public {
        (, uint256 issueId) = _createBatchAndIssue();

        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);

        vm.prank(resolver);
        vm.expectRevert("resolveIssue: already settled");
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);
    }

    function test_ResolveIssue_ZeroSettlementHash() public {
        (, uint256 issueId) = _createBatchAndIssue();

        vm.prank(resolver);
        vm.expectRevert("resolveIssue: settlementHash required");
        bt.resolveIssue(issueId, bytes32(0), false);
    }

    function test_ResolveIssue_EmitsIssueSettled() public {
        (uint256 batchId, uint256 issueId) = _createBatchAndIssue();

        vm.expectEmit(true, true, true, true);
        emit Counter.IssueSettled(
            issueId,
            batchId,
            Counter.IssueStatus.Resolved,
            SETTLEMENT_HASH,
            resolver,
            block.timestamp
        );

        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);
    }

    function test_ResolveIssue_EmitsBatchStatusChanged() public {
        (uint256 batchId, uint256 issueId) = _createBatchAndIssue();

        vm.expectEmit(true, false, false, true);
        emit Counter.BatchStatusChanged(
            batchId,
            Counter.BatchStatus.UnderReview,
            Counter.BatchStatus.Cleared,
            resolver,
            block.timestamp
        );

        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);
    }

    // ─────────────────────────────────────────────
    //  FULL LIFECYCLE
    // ─────────────────────────────────────────────

    function test_FullLifecycle_SuccessPath() public {
        // 1. Producer creates batch
        vm.prank(producer);
        uint256 batchId = bt.createBatch(META_HASH);
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.Active));

        // 2. Distributor logs two custody stops
        vm.prank(distributor);
        bt.updateCustody(batchId, keccak256("stop1"), "Left HCM warehouse");
        vm.prank(distributor);
        bt.updateCustody(batchId, keccak256("stop2"), "Arrived Hanoi DC");
        assertEq(bt.getCustodyLog(batchId).length, 2);

        // 3. Inspector opens issue -> batch locked UnderReview
        vm.prank(inspector);
        uint256 issueId = bt.reportIssue(batchId, ISSUE_HASH);
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.UnderReview));

        // 4. Inspector anchors evidence
        vm.prank(inspector);
        bt.anchorEvidence(issueId, EVIDENCE_HASH);

        // 5. Resolver settles -> cleared
        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, false);
        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.Cleared));
    }

    function test_FullLifecycle_RecallPath() public {
        // 1. Producer creates batch
        vm.prank(producer);
        uint256 batchId = bt.createBatch(META_HASH);

        // 2. Inspector opens issue
        vm.prank(inspector);
        uint256 issueId = bt.reportIssue(batchId, ISSUE_HASH);

        // 3. Inspector anchors evidence
        vm.prank(inspector);
        bt.anchorEvidence(issueId, EVIDENCE_HASH);

        // 4. Resolver settles with recall
        vm.prank(resolver);
        bt.resolveIssue(issueId, SETTLEMENT_HASH, true);

        assertEq(uint8(bt.getBatchStatus(batchId)), uint8(Counter.BatchStatus.Recalled));

        // 10 fields — chỉ lấy status ở vị trí 6 (index 5)
        (,,,,, Counter.IssueStatus iStatus,,,,) = bt.issues(issueId);
        assertEq(uint8(iStatus), uint8(Counter.IssueStatus.Recalled));
    }
}
