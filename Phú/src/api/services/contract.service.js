import {
  BatchStatus,
  EscrowStatus,
  IssueStatus,
  ResolutionType,
  contractAddress,
  findEvent,
  readCounter,
  toJsonSafe,
  writeCounter,
} from "../config/blockchain.js";
import { prisma, tryOffchainSync } from "../lib/prisma.js";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const DEFAULT_HASHES = {
  metadata: "0x1111111111111111111111111111111111111111111111111111111111111111",
  custody: "0x2222222222222222222222222222222222222222222222222222222222222222",
  issue: "0x3333333333333333333333333333333333333333333333333333333333333333",
  evidence: "0x4444444444444444444444444444444444444444444444444444444444444444",
  settlement: "0x5555555555555555555555555555555555555555555555555555555555555555",
};

function normalizeTokenId(value) {
  return BigInt(value);
}

function decimalEthFromWei(wei) {
  return Number(wei) / 1e18;
}

function mapBatch(batch) {
  return {
    id: batch[0],
    metadataHash: batch[1],
    metadataCID: batch[2],
    producer: batch[3],
    currentOwner: batch[4],
    createdAt: batch[5],
    status: BatchStatus[Number(batch[6])],
    exists: batch[7],
    openIssueCount: batch[8],
  };
}

function mapIssue(issue) {
  return {
    id: issue[0],
    batchId: issue[1],
    issueHash: issue[2],
    issueType: issue[3],
    reporter: issue[4],
    reportedAt: issue[5],
    status: IssueStatus[Number(issue[6])],
    evidenceHash: issue[7],
    settlementHash: issue[8],
    resolutionType: Object.keys(ResolutionType).find((key) => ResolutionType[key] === Number(issue[9])),
    refundAmount: issue[10],
    resolvedBy: issue[11],
    resolvedAt: issue[12],
    stakeholderConfirmed: issue[13],
  };
}

function mapEscrow(escrow) {
  return {
    batchId: escrow[0],
    payer: escrow[1],
    payee: escrow[2],
    amount: escrow[3],
    flatFee: escrow[4],
    lockedAt: escrow[5],
    settledAt: escrow[6],
    status: EscrowStatus[Number(escrow[7])],
    exists: escrow[8],
  };
}

export async function createBatch(params) {
  const { hash, receipt } = await writeCounter({
    role: "producer",
    privateKey: params.producerWallet,
    functionName: "createBatch",
    args: [params.metadataHashHex ?? DEFAULT_HASHES.metadata, params.metadataCID],
  });

  const event = findEvent(receipt, "BatchCreated");
  const tokenId = event?.args?.batchId?.toString();

  const offchain = await tryOffchainSync(async () => {
    if (!params.producerId) throw new Error("producerId is required for off-chain sync");
    const batch = await prisma.batchNft.upsert({
      where: { tokenId },
      update: {
        blockchainTxHash: hash,
        smartContractAddress: contractAddress,
        metadataIpfsCid: params.metadataCID,
      },
      create: {
        tokenId,
        producerId: params.producerId,
        productName: params.productName,
        origin: params.origin,
        harvestDate: params.harvestDate ? new Date(params.harvestDate) : null,
        certification: params.certification,
        batchNumber: params.batchNumber,
        blockchainTxHash: hash,
        smartContractAddress: contractAddress,
        metadataIpfsCid: params.metadataCID,
      },
    });

    await prisma.qrCode.upsert({
      where: { tokenId },
      update: { url: params.verifyUrl ?? `${process.env.APP_URL ?? "http://localhost:3000"}/verify/${tokenId}` },
      create: {
        qrId: `qr-${tokenId}`,
        tokenId,
        url: params.verifyUrl ?? `${process.env.APP_URL ?? "http://localhost:3000"}/verify/${tokenId}`,
      },
    });

    return batch;
  });

  return toJsonSafe({ tokenId, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function transferCustody(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "distributor",
    privateKey: params.callerWallet,
    functionName: "transferCustody",
    args: [normalizeTokenId(params.tokenId), params.toWallet],
  });

  const statusEvent = findEvent(receipt, "BatchStatusChanged");
  return toJsonSafe({
    tokenId: params.tokenId,
    txHash: hash,
    newStatus: statusEvent ? BatchStatus[Number(statusEvent.args.newStatus)] : null,
    blockNumber: receipt.blockNumber,
  });
}

export async function updateCustody(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "distributor",
    privateKey: params.callerWallet,
    functionName: "updateCustody",
    args: [normalizeTokenId(params.tokenId), params.updateHashHex ?? DEFAULT_HASHES.custody, params.note ?? ""],
  });

  const offchain = await tryOffchainSync(async () => {
    if (!params.txId) throw new Error("txId is required for shipment log sync");
    return prisma.shipmentLog.create({
      data: {
        logId: params.logId ?? `shiplog-${Date.now()}`,
        txId: params.txId,
        tokenId: String(params.tokenId),
        temperatureLogs: params.iotData?.temperature_logs ? JSON.stringify(params.iotData.temperature_logs) : null,
        humidityLogs: params.iotData?.humidity_logs ? JSON.stringify(params.iotData.humidity_logs) : null,
        gpsTrucking: params.iotData?.gps_tracking ? JSON.stringify(params.iotData.gps_tracking) : null,
        doorOpenClose: params.iotData?.door_events ? JSON.stringify(params.iotData.door_events) : null,
        logisticsDocuments: params.iotData?.logistics_documents
          ? JSON.stringify(params.iotData.logistics_documents)
          : null,
      },
    });
  });

  return toJsonSafe({ tokenId: params.tokenId, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function getBatchDetail(tokenId, query = {}) {
  const batch = mapBatch(await readCounter("batches", [normalizeTokenId(tokenId)]));
  const custodyLogIds = await readCounter("getCustodyLog", [normalizeTokenId(tokenId)]);
  const issueIds = await readCounter("getIssuesByBatch", [normalizeTokenId(tokenId)]);

  const offchain = await tryOffchainSync(async () => {
    const batchDoc = await prisma.batchNft.findUnique({ where: { tokenId: String(tokenId) } });
    if (query.queriedByType) {
      await prisma.queryHistory.create({
        data: {
          queryId: `qh-${Date.now()}`,
          tokenId: String(tokenId),
          queriedByType: query.queriedByType,
          queriedById: query.queriedById,
          metadataHashVerified: batch.metadataHash,
          integrityCheck: batch.metadataHash !== ZERO_HASH,
        },
      });
    }
    return batchDoc;
  });

  return toJsonSafe({ tokenId, onChain: batch, custodyLogIds, issueIds, offchain });
}

export async function reportIssue(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "inspector",
    privateKey: params.callerWallet,
    functionName: "reportIssue",
    args: [normalizeTokenId(params.tokenId), params.issueHashHex ?? DEFAULT_HASHES.issue, params.issueType],
  });

  const event = findEvent(receipt, "IssueOpened");
  const issueId = event?.args?.issueId?.toString();

  const offchain = await tryOffchainSync(async () => prisma.issueReport.create({
    data: {
      issueId: `issue-${issueId}`,
      tokenId: String(params.tokenId),
      reporterType: params.reporterType ?? "Inspector",
      reporterId: params.reporterId ?? "unknown",
      issueType: params.issueType,
      issueDescription: params.issueDescription,
      issueStatus: "Under_Review",
      blockchainTxHash: hash,
    },
  }));

  return toJsonSafe({ issueId, tokenId: params.tokenId, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function anchorEvidence(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "inspector",
    privateKey: params.callerWallet,
    functionName: "anchorEvidence",
    args: [normalizeTokenId(params.issueId), params.evidenceHashHex ?? DEFAULT_HASHES.evidence],
  });

  const offchain = await tryOffchainSync(async () => prisma.issueReport.update({
    where: { issueId: `issue-${params.issueId}` },
    data: { evidenceIpfsCid: params.evidenceCIDs?.join(",") ?? params.evidenceCID },
  }));

  return toJsonSafe({ issueId: params.issueId, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function confirmResolution(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "producer",
    privateKey: params.callerWallet,
    functionName: "confirmResolution",
    args: [normalizeTokenId(params.issueId)],
  });

  return toJsonSafe({ issueId: params.issueId, confirmed: true, txHash: hash, blockNumber: receipt.blockNumber });
}

export async function resolveIssue(params) {
  const resolutionCode = ResolutionType[params.resolutionType];
  if (resolutionCode === undefined) throw new Error(`Invalid resolutionType: ${params.resolutionType}`);

  const { hash, receipt } = await writeCounter({
    role: params.role ?? "resolver",
    privateKey: params.callerWallet,
    functionName: "resolveIssue",
    args: [
      normalizeTokenId(params.issueId),
      params.settlementHashHex ?? DEFAULT_HASHES.settlement,
      resolutionCode,
      BigInt(params.refundAmountWei ?? params.refundAmount ?? 0),
    ],
  });

  const issue = mapIssue(await readCounter("issues", [normalizeTokenId(params.issueId)]));
  const financialImpact =
    params.resolutionType === "Refund" || params.resolutionType === "RefundPartial"
      ? "Refund"
      : params.resolutionType === "Recalled"
        ? "Deduct_Carrier"
        : "No_Action";

  const offchain = await tryOffchainSync(async () => {
    const resolution = await prisma.resolution.create({
      data: {
        resolutionId: `res-${params.issueId}-${Date.now()}`,
        issueId: `issue-${params.issueId}`,
        resolutionType: params.resolutionType,
        resolvedBy: params.resolvedById ?? "resolver",
        resolutionDescription: params.resolutionDescription,
        settlementDocUrl: params.settlementDocUrl,
        financialImpact,
        refundAmount: decimalEthFromWei(Number(params.refundAmountWei ?? params.refundAmount ?? 0)),
        recallBatch: params.resolutionType === "Recalled",
        blockchainTxHash: hash,
        resolvedAt: new Date(),
      },
    });
    await prisma.issueReport.update({
      where: { issueId: `issue-${params.issueId}` },
      data: { issueStatus: "Resolved" },
    });
    return resolution;
  });

  return toJsonSafe({ issueId: params.issueId, issue, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function getIssueDetail(issueId) {
  const issue = mapIssue(await readCounter("issues", [normalizeTokenId(issueId)]));
  const offchain = await tryOffchainSync(async () => ({
    issue: await prisma.issueReport.findUnique({ where: { issueId: `issue-${issueId}` } }),
    resolution: await prisma.resolution.findUnique({ where: { issueId: `issue-${issueId}` } }),
  }));
  return toJsonSafe({ issueId, onChain: issue, offchain });
}

export async function lockPayment(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "retailer",
    privateKey: params.callerWallet,
    functionName: "lockPayment",
    args: [
      normalizeTokenId(params.tokenId),
      params.payeeWallet,
      BigInt(params.flatFeeWei ?? 0),
    ],
    value: BigInt(params.amountWei),
  });

  const txId = params.txId ?? `tx-${params.tokenId}-${Date.now()}`;
  const offchain = await tryOffchainSync(async () => prisma.businessTransaction.create({
    data: {
      txId,
      tokenId: String(params.tokenId),
      carrierId: params.carrierId,
      customerId: params.customerId,
      escrowStatus: "Locked",
      escrowAmount: decimalEthFromWei(Number(params.amountWei)),
      blockchainTxHash: hash,
      smartContractAddress: contractAddress,
      billingDetail: params.billingDetail
        ? {
            create: {
              billingId: `bill-${txId}`,
              flatFee: params.billingDetail.flat_fee ?? 0,
              logisticsFee: params.billingDetail.logistics_fee ?? 0,
              taxAmount: params.billingDetail.tax_amount ?? 0,
              totalAmount: params.billingDetail.total_amount ?? decimalEthFromWei(Number(params.amountWei)),
              billingStatus: "Pending",
            },
          }
        : undefined,
    },
  }));

  return toJsonSafe({ txId, tokenId: params.tokenId, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function releasePayment(params) {
  const { hash, receipt } = await writeCounter({
    role: params.role ?? "retailer",
    privateKey: params.callerWallet,
    functionName: "releasePayment",
    args: [normalizeTokenId(params.tokenId)],
  });

  const offchain = await tryOffchainSync(async () => prisma.businessTransaction.updateMany({
    where: { tokenId: String(params.tokenId), escrowStatus: "Locked" },
    data: {
      escrowStatus: "Released",
      paymentReleasedAt: new Date(),
      paymentReleasedReason: params.reason ?? "Delivery confirmed",
    },
  }));

  return toJsonSafe({ tokenId: params.tokenId, released: true, txHash: hash, blockNumber: receipt.blockNumber, offchain });
}

export async function getEscrowDetail(tokenId) {
  const escrow = mapEscrow(await readCounter("escrows", [normalizeTokenId(tokenId)]));
  const offchain = await tryOffchainSync(async () => prisma.businessTransaction.findFirst({
    where: { tokenId: String(tokenId) },
    orderBy: { createdAt: "desc" },
  }));
  return toJsonSafe({ tokenId, onChain: escrow, offchain });
}
