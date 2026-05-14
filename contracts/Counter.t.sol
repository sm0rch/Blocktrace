// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Counter} from "./Counter.sol";
import {Test}    from "forge-std/Test.sol";

contract CounterTest is Test {
    Counter counter;

    // ─────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────

    function setUp() public {
        counter = new Counter();
    }

    // ─────────────────────────────────────────────
    //  Counter (giữ nguyên)
    // ─────────────────────────────────────────────

    function test_InitialValue() public view {
        require(counter.x() == 0, "Initial value should be 0");
    }

    function testFuzz_Inc(uint8 x) public {
        for (uint8 i = 0; i < x; i++) {
            counter.inc();
        }
        require(counter.x() == x, "Value after calling inc x times should be x");
    }

    function test_IncByZero() public {
        vm.expectRevert();
        counter.incBy(0);
    }

    // ─────────────────────────────────────────────
    //  createBatch
    // ─────────────────────────────────────────────

    function test_CreateBatch() public {
        uint256 batchId = counter.createBatch("Batch A");

        (
            uint256 id,
            string memory desc,
            address creator,
            uint256 createdAt,
            bool exists
        ) = counter.batches(batchId);

        assertEq(id, 0);
        assertEq(desc, "Batch A");
        assertEq(creator, address(this));
        assertGt(createdAt, 0);
        assertTrue(exists);
    }

    function test_CreateBatch_EmptyDescription() public {
        vm.expectRevert("createBatch: description required");
        counter.createBatch("");
    }

    function test_CreateBatch_EmitsEvent() public {
        vm.expectEmit(true, false, true, true);
        emit Counter.BatchCreated(0, "Batch B", address(this), block.timestamp);
        counter.createBatch("Batch B");
    }

    function test_CreateBatch_IncrementId() public {
        uint256 id0 = counter.createBatch("Batch 0");
        uint256 id1 = counter.createBatch("Batch 1");
        uint256 id2 = counter.createBatch("Batch 2");

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    // ─────────────────────────────────────────────
    //  reportIssue
    // ─────────────────────────────────────────────

    function test_ReportIssue() public {
        uint256 batchId = counter.createBatch("Batch A");
        uint256 issueId = counter.reportIssue(batchId, "Defective product");

        (
            uint256 id,
            uint256 bId,
            string memory desc,
            address reporter,
            uint256 reportedAt,
            bool resolved,
            address resolvedBy,
            uint256 resolvedAt
        ) = counter.issues(issueId);

        assertEq(id, 0);
        assertEq(bId, batchId);
        assertEq(desc, "Defective product");
        assertEq(reporter, address(this));
        assertGt(reportedAt, 0);
        assertFalse(resolved);
        assertEq(resolvedBy, address(0));
        assertEq(resolvedAt, 0);
    }

    function test_ReportIssue_BatchNotFound() public {
        vm.expectRevert("reportIssue: batch not found");
        counter.reportIssue(999, "Some issue");
    }

    function test_ReportIssue_EmptyDescription() public {
        uint256 batchId = counter.createBatch("Batch A");
        vm.expectRevert("reportIssue: description required");
        counter.reportIssue(batchId, "");
    }

    function test_ReportIssue_EmitsEvent() public {
        uint256 batchId = counter.createBatch("Batch A");

        vm.expectEmit(true, true, true, true);
        emit Counter.IssueReported(0, batchId, "Defective product", address(this), block.timestamp);
        counter.reportIssue(batchId, "Defective product");
    }

    function test_ReportIssue_AppearsInBatchIssues() public {
        uint256 batchId = counter.createBatch("Batch A");
        counter.reportIssue(batchId, "Issue 1");
        counter.reportIssue(batchId, "Issue 2");

        uint256[] memory issueIds = counter.getIssuesByBatch(batchId);
        assertEq(issueIds.length, 2);
        assertEq(issueIds[0], 0);
        assertEq(issueIds[1], 1);
    }

    // ─────────────────────────────────────────────
    //  resolveIssue
    // ─────────────────────────────────────────────

    function test_ResolveIssue() public {
        uint256 batchId = counter.createBatch("Batch A");
        uint256 issueId = counter.reportIssue(batchId, "Defective product");

        counter.resolveIssue(issueId);

        (
            ,,,,,
            bool resolved,
            address resolvedBy,
            uint256 resolvedAt
        ) = counter.issues(issueId);

        assertTrue(resolved);
        assertEq(resolvedBy, address(this));
        assertGt(resolvedAt, 0);
    }

    function test_ResolveIssue_NotFound() public {
        vm.expectRevert("resolveIssue: issue not found");
        counter.resolveIssue(999);
    }

    function test_ResolveIssue_AlreadyResolved() public {
        uint256 batchId = counter.createBatch("Batch A");
        uint256 issueId = counter.reportIssue(batchId, "Defective product");

        counter.resolveIssue(issueId);

        vm.expectRevert("resolveIssue: already resolved");
        counter.resolveIssue(issueId);
    }

    function test_ResolveIssue_EmitsEvent() public {
        uint256 batchId = counter.createBatch("Batch A");
        uint256 issueId = counter.reportIssue(batchId, "Defective product");

        vm.expectEmit(true, true, true, true);
        emit Counter.IssueResolved(issueId, batchId, address(this), block.timestamp);
        counter.resolveIssue(issueId);
    }

    function test_ResolveIssue_DifferentCaller() public {
        address alice = makeAddr("alice");
        address bob   = makeAddr("bob");

        vm.prank(alice);
        uint256 batchId = counter.createBatch("Batch A");

        vm.prank(alice);
        uint256 issueId = counter.reportIssue(batchId, "Defective product");

        vm.prank(bob);
        counter.resolveIssue(issueId);

        (,,,,,, address resolvedBy,) = counter.issues(issueId);
        assertEq(resolvedBy, bob);
    }
}
