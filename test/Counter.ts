import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("Counter", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  const [
    adminClient,
    producerClient,
    inspectorClient,
    resolverClient,
    distributorClient,
    retailerClient,
    strangerClient,
  ] = await viem.getWalletClients();

  const adminAddress       = adminClient.account.address;
  const producerAddress    = producerClient.account.address;
  const inspectorAddress   = inspectorClient.account.address;
  const resolverAddress    = resolverClient.account.address;
  const distributorAddress = distributorClient.account.address;
  const retailerAddress    = retailerClient.account.address;
  const strangerAddress    = strangerClient.account.address;

  // ─────────────────────────────────────────────
  //  Constants
  // ─────────────────────────────────────────────

  const META_HASH       = "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`;
  const ISSUE_HASH      = "0x2222222222222222222222222222222222222222222222222222222222222222" as `0x${string}`;
  const SETTLEMENT_HASH = "0x3333333333333333333333333333333333333333333333333333333333333333" as `0x${string}`;
  const UPDATE_HASH     = "0x4444444444444444444444444444444444444444444444444444444444444444" as `0x${string}`;
  const EVIDENCE_HASH   = "0x5555555555555555555555555555555555555555555555555555555555555555" as `0x${string}`;

  // [~] createBatch nhận thêm metadataCID
  const META_CID   = "QmExampleCID123456789";
  const ISSUE_TYPE = "TEMPERATURE_VIOLATION";

  // ResolutionType enum index (phải khớp thứ tự trong contract)
  const ResolutionType = {
    None: 0, Cleared: 1, Refund: 2, RefundPartial: 3, Replaced: 4, Recalled: 5,
  } as const;

  // BatchStatus enum index
  const BatchStatus = {
    Minted: 0, InTransit: 1, Delivered: 2, UnderReview: 3, Recalled: 4, Cleared: 5,
  } as const;

  // IssueStatus enum index
  const IssueStatus = {
    Open: 0, UnderReview: 1, Resolved: 2, Recalled: 3,
  } as const;

  // ─────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────

  async function deployAndSetupRoles() {
    const counter = await viem.deployContract("Counter", [adminAddress]);

    const PRODUCER_ROLE    = await counter.read.PRODUCER_ROLE();
    const DISTRIBUTOR_ROLE = await counter.read.DISTRIBUTOR_ROLE();
    const RETAILER_ROLE    = await counter.read.RETAILER_ROLE();
    const INSPECTOR_ROLE   = await counter.read.INSPECTOR_ROLE();
    const RESOLVER_ROLE    = await counter.read.RESOLVER_ROLE();

    await counter.write.grantRole([PRODUCER_ROLE,    producerAddress],    { account: adminClient.account });
    await counter.write.grantRole([DISTRIBUTOR_ROLE, distributorAddress], { account: adminClient.account });
    await counter.write.grantRole([RETAILER_ROLE,    retailerAddress],    { account: adminClient.account });
    await counter.write.grantRole([INSPECTOR_ROLE,   inspectorAddress],   { account: adminClient.account });
    await counter.write.grantRole([RESOLVER_ROLE,    resolverAddress],    { account: adminClient.account });

    return counter;
  }

  // [~] createBatch giờ nhận 2 tham số
  async function createBatch(counter: Awaited<ReturnType<typeof deployAndSetupRoles>>) {
    const tx = await counter.write.createBatch([META_HASH, META_CID], { account: producerClient.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    const fromBlock = receipt.blockNumber;
    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "BatchCreated", fromBlock, strict: true,
    });
    return events[0].args.batchId as bigint;
  }

  async function createBatchAndIssue(counter: Awaited<ReturnType<typeof deployAndSetupRoles>>) {
    const batchId = await createBatch(counter);
    const fromBlock = await publicClient.getBlockNumber();
    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: inspectorClient.account });
    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueOpened", fromBlock, strict: true,
    });
    const issueId = events[0].args.issueId as bigint;
    return { batchId, issueId };
  }

  // [ADD-3] Anchor evidence rồi confirm để resolver có thể chốt
  async function anchorAndConfirm(
    counter: Awaited<ReturnType<typeof deployAndSetupRoles>>,
    issueId: bigint,
  ) {
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await counter.write.confirmResolution([issueId], { account: producerClient.account });
  }

  async function transferToDistributor(
    counter: Awaited<ReturnType<typeof deployAndSetupRoles>>,
    batchId: bigint,
  ) {
    await counter.write.transferCustody([batchId, distributorAddress], { account: producerClient.account });
  }

  async function transferToRetailer(
    counter: Awaited<ReturnType<typeof deployAndSetupRoles>>,
    batchId: bigint,
  ) {
    await transferToDistributor(counter, batchId);
    await counter.write.transferCustody([batchId, retailerAddress], { account: distributorClient.account });
  }

  // ─────────────────────────────────────────────
  //  CREATE BATCH
  // ─────────────────────────────────────────────

  it("Should emit BatchCreated event when calling createBatch()", async function () {
    const counter = await deployAndSetupRoles();
    const fromBlock = await publicClient.getBlockNumber();

    // [~] Truyền đủ 2 tham số: metadataHash + metadataCID
    await counter.write.createBatch([META_HASH, META_CID], { account: producerClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "BatchCreated", fromBlock, strict: true,
    });

    assert.equal(events.length, 1, "Phải có đúng 1 sự kiện BatchCreated");
    assert.equal(events[0].args.metadataHash, META_HASH);
    assert.equal(events[0].args.metadataCID, META_CID);
    assert.equal(events[0].args.producer?.toLowerCase(), producerAddress.toLowerCase());
  });

  it("BatchCreated event count should match number of batches created", async function () {
    const counter = await deployAndSetupRoles();
    const fromBlock = await publicClient.getBlockNumber();

    const BATCH_COUNT = 5;
    for (let i = 0; i < BATCH_COUNT; i++) {
      const hash = `0x${String(i + 1).padStart(64, "1")}` as `0x${string}`;
      // [~] Thêm CID cho mỗi batch
      await counter.write.createBatch([hash, `QmCID${i}`], { account: producerClient.account });
    }

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "BatchCreated", fromBlock, strict: true,
    });

    assert.equal(BigInt(events.length), BigInt(BATCH_COUNT));
    for (let i = 0; i < BATCH_COUNT; i++) {
      assert.equal(events[i].args.batchId, BigInt(i));
    }
  });

  it("Should revert createBatch() if called by non-producer", async function () {
    const counter = await deployAndSetupRoles();
    await assert.rejects(
      counter.write.createBatch([META_HASH, META_CID], { account: strangerClient.account }),
    );
  });

  it("Should revert createBatch() with zero metadataHash", async function () {
    const counter = await deployAndSetupRoles();
    const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
    await assert.rejects(
      counter.write.createBatch([zeroHash, META_CID], { account: producerClient.account }),
    );
  });

  it("Should revert createBatch() with empty metadataCID", async function () {
    const counter = await deployAndSetupRoles();
    await assert.rejects(
      counter.write.createBatch([META_HASH, ""], { account: producerClient.account }),
    );
  });

  // ─────────────────────────────────────────────
  //  TRANSFER CUSTODY
  // ─────────────────────────────────────────────

  it("Should transfer custody Producer → Distributor and emit CustodyTransferred", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.transferCustody([batchId, distributorAddress], { account: producerClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "CustodyTransferred", fromBlock, strict: true,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].args.from?.toLowerCase(), producerAddress.toLowerCase());
    assert.equal(events[0].args.to?.toLowerCase(), distributorAddress.toLowerCase());

    const owner = await counter.read.getCurrentOwner([batchId]);
    assert.equal(owner.toLowerCase(), distributorAddress.toLowerCase());
  });

  it("Should set batch status to InTransit after transfer to distributor", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await transferToDistributor(counter, batchId);

    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.InTransit);
  });

  it("Should set batch status to Delivered after transfer to retailer", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await transferToRetailer(counter, batchId);

    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Delivered);
  });

  // [FIX-1] Từ Minted không được chuyển thẳng đến Retailer
  it("Should revert transferCustody() from Minted directly to retailer", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await assert.rejects(
      counter.write.transferCustody([batchId, retailerAddress], { account: producerClient.account }),
    );
  });

  // [FIX-1] Recipient phải có DISTRIBUTOR hoặc RETAILER role
  it("Should revert transferCustody() if recipient has no valid role", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await assert.rejects(
      counter.write.transferCustody([batchId, strangerAddress], { account: producerClient.account }),
    );
  });

  it("Should revert transferCustody() when batch is UnderReview", async function () {
    const counter = await deployAndSetupRoles();
    const { batchId } = await createBatchAndIssue(counter);
    await assert.rejects(
      counter.write.transferCustody([batchId, distributorAddress], { account: producerClient.account }),
    );
  });

  it("Should revert transferCustody() when batch is already Delivered", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await transferToRetailer(counter, batchId);
    await assert.rejects(
      counter.write.transferCustody([batchId, distributorAddress], { account: retailerClient.account }),
    );
  });

  // ─────────────────────────────────────────────
  //  UPDATE CUSTODY
  // ─────────────────────────────────────────────

  it("Should emit CustodyUpdated event after updateCustody()", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    // [FIX-2] distributor phải là currentOwner
    await transferToDistributor(counter, batchId);
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.updateCustody([batchId, UPDATE_HASH, "Left HCM warehouse"], {
      account: distributorClient.account,
    });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "CustodyUpdated", fromBlock, strict: true,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].args.updateHash, UPDATE_HASH);
    assert.equal(events[0].args.note, "Left HCM warehouse");
    assert.equal(events[0].args.actor?.toLowerCase(), distributorAddress.toLowerCase());
  });

  // [FIX-2] Distributor không còn là currentOwner → revert
  it("Should revert updateCustody() if caller is not current owner", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await transferToDistributor(counter, batchId);
    await counter.write.transferCustody([batchId, retailerAddress], { account: distributorClient.account });

    await assert.rejects(
      counter.write.updateCustody([batchId, UPDATE_HASH, "note"], { account: distributorClient.account }),
    );
  });

  it("getCustodyLog() should return correct number of entries", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    await transferToDistributor(counter, batchId);

    await counter.write.updateCustody([batchId, `0x${"a".repeat(64)}` as `0x${string}`, "Stop 1"], {
      account: distributorClient.account,
    });
    await counter.write.updateCustody([batchId, `0x${"b".repeat(64)}` as `0x${string}`, "Stop 2"], {
      account: distributorClient.account,
    });

    const log = await counter.read.getCustodyLog([batchId]);
    assert.equal(log.length, 2);
  });

  // ─────────────────────────────────────────────
  //  REPORT ISSUE
  // ─────────────────────────────────────────────

  it("Should emit IssueOpened and lock batch to UnderReview after reportIssue()", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    const fromBlock = await publicClient.getBlockNumber();

    // [~] reportIssue nhận thêm issueType
    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: inspectorClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueOpened", fromBlock, strict: true,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].args.issueHash, ISSUE_HASH);
    assert.equal(events[0].args.issueType, ISSUE_TYPE);
    assert.equal(events[0].args.reporter?.toLowerCase(), inspectorAddress.toLowerCase());

    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.UnderReview);
  });

  it("Should allow retailer to reportIssue()", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: retailerClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueOpened", fromBlock, strict: true,
    });
    assert.equal(events[0].args.reporter?.toLowerCase(), retailerAddress.toLowerCase());
  });

  it("Should allow distributor to reportIssue()", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: distributorClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueOpened", fromBlock, strict: true,
    });
    assert.equal(events[0].args.reporter?.toLowerCase(), distributorAddress.toLowerCase());
  });

  // [FIX-5] openIssueCount tăng khi mở issue
  it("Should increment openIssueCount after reportIssue()", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);

    let count = await counter.read.getOpenIssueCount([batchId]);
    assert.equal(count, 0n);

    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: inspectorClient.account });

    count = await counter.read.getOpenIssueCount([batchId]);
    assert.equal(count, 1n);
  });

  it("Should revert reportIssue() when batch is already UnderReview", async function () {
    const counter = await deployAndSetupRoles();
    const { batchId } = await createBatchAndIssue(counter);
    await assert.rejects(
      counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: inspectorClient.account }),
    );
  });

  // ─────────────────────────────────────────────
  //  ANCHOR EVIDENCE
  // ─────────────────────────────────────────────

  it("Should emit EvidenceAnchored and set status to UnderReview after anchorEvidence()", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "EvidenceAnchored", fromBlock, strict: true,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].args.evidenceHash, EVIDENCE_HASH);
    assert.equal(events[0].args.anchoredBy?.toLowerCase(), inspectorAddress.toLowerCase());

    const issue = await counter.read.issues([issueId]);
    assert.equal(issue[7], EVIDENCE_HASH);                           // evidenceHash field (index 7)
    assert.equal(Number(issue[6]), IssueStatus.UnderReview);          // status field (index 6)
  });

  it("Should allow retailer to anchorEvidence()", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: retailerClient.account });
    const issue = await counter.read.issues([issueId]);
    assert.equal(issue[7], EVIDENCE_HASH);
  });

  // [FIX-3] Không được overwrite evidenceHash
  it("Should revert anchorEvidence() if evidence already anchored", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await assert.rejects(
      counter.write.anchorEvidence(
        [issueId, `0x${"9".repeat(64)}` as `0x${string}`],
        { account: inspectorClient.account },
      ),
    );
  });

  it("Should revert anchorEvidence() if issue is already resolved", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);
    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
      { account: resolverClient.account },
    );
    await assert.rejects(
      counter.write.anchorEvidence(
        [issueId, `0x${"9".repeat(64)}` as `0x${string}`],
        { account: inspectorClient.account },
      ),
    );
  });

  // ─────────────────────────────────────────────
  //  CONFIRM RESOLUTION  [ADD-3]
  // ─────────────────────────────────────────────

  it("Should allow producer to confirmResolution() after evidence is anchored", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });

    const fromBlock = await publicClient.getBlockNumber();
    await counter.write.confirmResolution([issueId], { account: producerClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "ResolutionConfirmed", fromBlock, strict: true,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].args.confirmedBy?.toLowerCase(), producerAddress.toLowerCase());

    const confirmed = await counter.read.isResolutionConfirmed([issueId]);
    assert.equal(confirmed, true);
  });

  it("Should allow distributor to confirmResolution()", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await counter.write.confirmResolution([issueId], { account: distributorClient.account });
    const confirmed = await counter.read.isResolutionConfirmed([issueId]);
    assert.equal(confirmed, true);
  });

  it("Should allow retailer to confirmResolution()", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await counter.write.confirmResolution([issueId], { account: retailerClient.account });
    const confirmed = await counter.read.isResolutionConfirmed([issueId]);
    assert.equal(confirmed, true);
  });

  it("Should revert confirmResolution() if evidence not yet anchored", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await assert.rejects(
      counter.write.confirmResolution([issueId], { account: producerClient.account }),
    );
  });

  it("Should revert confirmResolution() if called by inspector (separation of duties)", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await assert.rejects(
      counter.write.confirmResolution([issueId], { account: inspectorClient.account }),
    );
  });

  it("Should revert confirmResolution() if called by resolver (separation of duties)", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await assert.rejects(
      counter.write.confirmResolution([issueId], { account: resolverClient.account }),
    );
  });

  it("Should revert confirmResolution() if already confirmed", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await counter.write.confirmResolution([issueId], { account: producerClient.account });
    await assert.rejects(
      counter.write.confirmResolution([issueId], { account: distributorClient.account }),
    );
  });

  // ─────────────────────────────────────────────
  //  RESOLVE ISSUE
  // ─────────────────────────────────────────────

  it("Should emit IssueSettled and set batch to Cleared after resolveIssue(Cleared)", async function () {
    const counter = await deployAndSetupRoles();
    const { batchId, issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
      { account: resolverClient.account },
    );

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueSettled", fromBlock, strict: true,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].args.settlementHash, SETTLEMENT_HASH);
    assert.equal(Number(events[0].args.resolutionType), ResolutionType.Cleared);
    assert.equal(events[0].args.resolvedBy?.toLowerCase(), resolverAddress.toLowerCase());

    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Cleared);

    const count = await counter.read.getOpenIssueCount([batchId]);
    assert.equal(count, 0n);
  });

  it("Should set batch to Recalled after resolveIssue(Recalled)", async function () {
    const counter = await deployAndSetupRoles();
    const { batchId, issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);

    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Recalled],
      { account: resolverClient.account },
    );

    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Recalled);

    const issue = await counter.read.issues([issueId]);
    assert.equal(Number(issue[6]), IssueStatus.Recalled);
  });

  it("Should resolve with Refund resolution type", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);

    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Refund],
      { account: resolverClient.account },
    );

    const issue = await counter.read.issues([issueId]);
    assert.equal(Number(issue[9]), ResolutionType.Refund);
  });

  // [ADD] RefundPartial mới
  it("Should resolve with RefundPartial resolution type", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);

    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.RefundPartial],
      { account: resolverClient.account },
    );

    const issue = await counter.read.issues([issueId]);
    assert.equal(Number(issue[9]), ResolutionType.RefundPartial);
  });

  // [ADD-2] Phải anchor evidence trước khi resolve
  it("Should revert resolveIssue() if evidence not anchored", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await assert.rejects(
      counter.write.resolveIssue(
        [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
        { account: resolverClient.account },
      ),
    );
  });

  // [ADD-3] Phải có stakeholderConfirmed trước khi resolve
  it("Should revert resolveIssue() if stakeholder has not confirmed", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });
    await assert.rejects(
      counter.write.resolveIssue(
        [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
        { account: resolverClient.account },
      ),
    );
  });

  it("Should revert resolveIssue() if called by non-resolver", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);
    await assert.rejects(
      counter.write.resolveIssue(
        [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
        { account: strangerClient.account },
      ),
    );
  });

  it("Should revert resolveIssue() if already settled", async function () {
    const counter = await deployAndSetupRoles();
    const { issueId } = await createBatchAndIssue(counter);
    await anchorAndConfirm(counter, issueId);
    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
      { account: resolverClient.account },
    );
    await assert.rejects(
      counter.write.resolveIssue(
        [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
        { account: resolverClient.account },
      ),
    );
  });

  // ─────────────────────────────────────────────
  //  PAUSE / UNPAUSE  [ADD-1]
  // ─────────────────────────────────────────────

  it("Should allow admin to pause and block createBatch()", async function () {
    const counter = await deployAndSetupRoles();
    await counter.write.pause({ account: adminClient.account });
    await assert.rejects(
      counter.write.createBatch([META_HASH, META_CID], { account: producerClient.account }),
    );
  });

  it("Should revert pause() if called by non-admin", async function () {
    const counter = await deployAndSetupRoles();
    await assert.rejects(
      counter.write.pause({ account: producerClient.account }),
    );
  });

  it("Should restore functionality after unpause()", async function () {
    const counter = await deployAndSetupRoles();
    await counter.write.pause({ account: adminClient.account });
    await counter.write.unpause({ account: adminClient.account });
    const batchId = await createBatch(counter);
    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Minted);
  });

  it("Should emit ContractPaused event when paused", async function () {
    const counter = await deployAndSetupRoles();
    const fromBlock = await publicClient.getBlockNumber();
    await counter.write.pause({ account: adminClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "ContractPaused", fromBlock, strict: true,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].args.by?.toLowerCase(), adminAddress.toLowerCase());
  });

  // ─────────────────────────────────────────────
  //  FULL LIFECYCLE
  // ─────────────────────────────────────────────

  it("Full success lifecycle: Mint → Transit → Deliver → Issue → Resolve (Cleared)", async function () {
    const counter = await deployAndSetupRoles();

    // 1. Producer mint batch
    const batchId = await createBatch(counter);
    let batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Minted);

    // 2. Producer → Distributor: InTransit  [FIX-1]
    await counter.write.transferCustody([batchId, distributorAddress], { account: producerClient.account });
    batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.InTransit);

    // 3. Distributor ghi 2 mốc vận chuyển  [FIX-2]
    await counter.write.updateCustody([batchId, `0x${"a".repeat(64)}` as `0x${string}`, "Left HCM"], {
      account: distributorClient.account,
    });
    await counter.write.updateCustody([batchId, `0x${"b".repeat(64)}` as `0x${string}`, "Arrived Hanoi"], {
      account: distributorClient.account,
    });
    const log = await counter.read.getCustodyLog([batchId]);
    assert.equal(log.length, 2);

    // 4. Distributor → Retailer: Delivered
    await counter.write.transferCustody([batchId, retailerAddress], { account: distributorClient.account });
    batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Delivered);

    // 5. Inspector mở issue → UnderReview
    const fromBlock = await publicClient.getBlockNumber();
    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: inspectorClient.account });
    const issueEvents = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueOpened", fromBlock, strict: true,
    });
    const issueId = issueEvents[0].args.issueId as bigint;
    batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.UnderReview);
    assert.equal(await counter.read.getOpenIssueCount([batchId]), 1n);

    // 6. Inspector neo evidence  [ADD-2]
    await counter.write.anchorEvidence([issueId, EVIDENCE_HASH], { account: inspectorClient.account });

    // 7. Producer xác nhận phương án  [ADD-3]
    await counter.write.confirmResolution([issueId], { account: producerClient.account });
    assert.equal(await counter.read.isResolutionConfirmed([issueId]), true);

    // 8. Resolver chốt Cleared  [FIX-5]
    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Cleared],
      { account: resolverClient.account },
    );
    batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Cleared);
    assert.equal(await counter.read.getOpenIssueCount([batchId]), 0n);
  });

  it("Full recall lifecycle: Mint → Issue → Evidence → Confirm → Recalled", async function () {
    const counter = await deployAndSetupRoles();
    const batchId = await createBatch(counter);

    await counter.write.reportIssue([batchId, ISSUE_HASH, ISSUE_TYPE], { account: inspectorClient.account });
    const fromBlock = await publicClient.getBlockNumber();
    const issueEvents = await publicClient.getContractEvents({
      address: counter.address, abi: counter.abi, eventName: "IssueOpened", fromBlock: 0n, strict: true,
    });
    const issueId = issueEvents[0].args.issueId as bigint;

    await anchorAndConfirm(counter, issueId);

    await counter.write.resolveIssue(
      [issueId, SETTLEMENT_HASH, ResolutionType.Recalled],
      { account: resolverClient.account },
    );

    const batch = await counter.read.batches([batchId]);
    assert.equal(Number(batch[6]), BatchStatus.Recalled);

    const issue = await counter.read.issues([issueId]);
    assert.equal(Number(issue[6]), IssueStatus.Recalled);
    assert.equal(await counter.read.getOpenIssueCount([batchId]), 0n);
  });
});
