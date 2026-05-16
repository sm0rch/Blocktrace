// ============================================================
// BlockTrace — Express Route Handlers (boilerplate)
// Stack: Express + Prisma (PostgreSQL) + Mongoose (MongoDB)
// Auth: JWT wallet-signed | RBAC: onlyRole middleware
// ============================================================

import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import crypto from "crypto";
import multer from "multer";

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// ─── TYPE EXTENSIONS ─────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; walletAddress: string; role: string };
    }
  }
}

// ════════════════════════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════════════════════════

// --- JWT Auth ---
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token" });
  try {
    const payload = verifyJwt(token); // implement với jsonwebtoken
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}

// --- RBAC: onlyRole ---
export function onlyRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: `Required role: ${roles.join(" | ")}`,
      });
    }
    next();
  };
}

// --- Async wrapper ---
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// --- Placeholder stubs (implement theo project) ---
function generateJwt(payload: object): string { return "jwt-token"; }
function verifyJwt(token: string): any { return {}; }
async function uploadToIpfs(buffer: Buffer, mimetype: string): Promise<{ cid: string; size: number }> {
  return { cid: "ipfs://QmExample...", size: buffer.length };
}
async function callSmartContract(method: string, args: unknown[]): Promise<{ txHash: string }> {
  return { txHash: "0xTxHash..." };
}
function sha256(data: string): string {
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}
function generateNonce(): string {
  return "blocktrace-nonce-" + crypto.randomBytes(16).toString("hex");
}

// ════════════════════════════════════════════════════════════
// 1. AUTH ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /auth/wallet/nonce
 * Public — Bước 1: lấy nonce để ký bằng MetaMask
 */
router.post("/auth/wallet/nonce", wrap(async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ code: "BAD_REQUEST", message: "walletAddress required" });

  const nonce = generateNonce();

  // Lưu nonce tạm vào DB hoặc Redis (TTL 5 phút)
  await prisma.user.upsert({
    where:  { walletAddress: walletAddress.toLowerCase() },
    update: {},
    create: {
      walletAddress: walletAddress.toLowerCase(),
      name: "Unknown",
      roleId: "default-role-id", // fallback role
    },
  });

  res.json({ nonce, walletAddress });
}));

/**
 * POST /auth/wallet/verify
 * Public — Bước 2: xác thực signature → trả JWT
 */
router.post("/auth/wallet/verify", wrap(async (req, res) => {
  const { walletAddress, signature } = req.body;

  // Verify signature với ethers
  const nonce = `blocktrace-nonce-...`; // fetch từ DB/Redis
  const recovered = ethers.verifyMessage(nonce, signature);
  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid signature" });
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: { role: true },
  });
  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });

  const accessToken = generateJwt({ id: user.id, walletAddress: user.walletAddress, role: user.role.name });
  res.json({ accessToken, expiresIn: 86400, user: formatUser(user) });
}));

/**
 * GET /auth/me
 * Authenticated — lấy thông tin user hiện tại
 */
router.get("/auth/me", authenticate, wrap(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { role: true },
  });
  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
  res.json(formatUser(user));
}));

/**
 * POST /auth/logout
 * Authenticated — invalidate JWT (blacklist token nếu dùng Redis)
 */
router.post("/auth/logout", authenticate, wrap(async (req, res) => {
  // TODO: thêm token vào Redis blacklist
  res.status(204).send();
}));

// ════════════════════════════════════════════════════════════
// 2. BATCH ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /batches
 * PRODUCER_ROLE — Tạo batch + mint NFT on-chain (Phase 1)
 */
router.post(
  "/batches",
  authenticate,
  onlyRole("PRODUCER_ROLE"),
  wrap(async (req, res) => {
    const { batchNumber, productName, origin, harvestDate, certification, metadataHash, metadataCid } = req.body;

    // 1. Gọi mintBatch() on-chain
    const { txHash } = await callSmartContract("mintBatch", [
      req.user!.walletAddress,
      metadataHash,
      metadataCid,
    ]);

    // 2. Lấy tokenId từ tx receipt (mock)
    const tokenId = Date.now(); // thay bằng parse event từ receipt

    // 3. Lưu vào PostgreSQL
    const batch = await prisma.batch.create({
      data: {
        tokenId:         BigInt(tokenId),
        batchNumber,
        productName,
        origin,
        harvestDate:     harvestDate ? new Date(harvestDate) : undefined,
        certification,
        metadataHash,
        metadataCid,
        mintTxHash:      txHash,
        qrUrl:           `https://blocktrace.app/verify/${tokenId}`,
        producerId:      req.user!.id,
        currentOwnerId:  req.user!.id,
        currentStatus:   "CREATED",
      },
      include: { producer: { include: { role: true } }, currentOwner: { include: { role: true } } },
    });

    // 4. Ghi audit trail (MongoDB)
    await writeAuditTrail(req, "CREATE_BATCH", "batch", batch.id, { tokenId, batchNumber }, txHash);

    res.status(201).json(formatBatch(batch));
  })
);

/**
 * GET /batches
 * Authenticated — danh sách batches với filter + pagination
 */
router.get("/batches", authenticate, wrap(async (req, res) => {
  const { status, producerId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (status)     where.currentStatus = status;
  if (producerId) where.producerId = producerId;

  const [data, total] = await Promise.all([
    prisma.batch.findMany({
      where, skip, take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: { producer: { include: { role: true } }, currentOwner: { include: { role: true } } },
    }),
    prisma.batch.count({ where }),
  ]);

  res.json({
    data: data.map(formatBatch),
    meta: { total, page: parseInt(page), limit: parseInt(limit), hasNext: skip + data.length < total },
  });
}));

/**
 * GET /batches/:tokenId
 * Public — lấy batch sau khi scan QR (Phase 6 entry)
 */
router.get("/batches/:tokenId", wrap(async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { tokenId: BigInt(req.params.tokenId) },
    include: { producer: { include: { role: true } }, currentOwner: { include: { role: true } } },
  });
  if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });
  res.json(formatBatch(batch));
}));

/**
 * GET /batches/:tokenId/verify
 * Public — verify integrity: rehash metadata → compare on-chain (Phase 6)
 */
router.get("/batches/:tokenId/verify", wrap(async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { tokenId: BigInt(req.params.tokenId) },
  });
  if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });

  // 1. Fetch metadata từ IPFS cache (MongoDB)
  const metadata = await fetchFromIpfsCache(batch.metadataCid);

  // 2. Rehash metadata
  const computedHash = sha256(JSON.stringify(metadata));

  // 3. So sánh với on-chain hash
  const hashMatched = computedHash === batch.metadataHash;

  // 4. Lưu verification log
  await prisma.consumerVerification.create({
    data: {
      tokenId:            batch.tokenId,
      batchId:            batch.id,
      fetchedMetadataCid: batch.metadataCid,
      onchainHash:        batch.metadataHash,
      computedHash,
      hashMatched,
      verificationResult: hashMatched ? "AUTHENTIC" : "TAMPERED",
      scannerIp:          req.ip,
    },
  });

  res.json({
    tokenId:            Number(batch.tokenId),
    onchainHash:        batch.metadataHash,
    computedHash,
    hashMatched,
    verificationResult: hashMatched ? "AUTHENTIC" : "TAMPERED",
    fetchedMetadataCid: batch.metadataCid,
    verifiedAt:         new Date().toISOString(),
  });
}));

/**
 * GET /batches/:tokenId/history
 * Authenticated — full history: transfers + blockchain events + issues
 */
router.get("/batches/:tokenId/history", authenticate, wrap(async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { tokenId: BigInt(req.params.tokenId) },
    include: {
      producer:     { include: { role: true } },
      currentOwner: { include: { role: true } },
      transfers:    { include: { fromUser: true, toUser: true }, orderBy: { transferredAt: "asc" } },
      issues:       { include: { reportedBy: true, resolution: true } },
    },
  });
  if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });

  // Lấy blockchain events từ MongoDB
  const { BlockchainEvent } = await import("./blocktrace_mongoose");
  const events = await BlockchainEvent
    .find({ tokenId: Number(batch.tokenId) })
    .sort({ blockNumber: 1 });

  res.json({
    batch:    formatBatch(batch),
    timeline: events.map(formatEvent),
    issues:   (batch as any).issues.map(formatIssue),
  });
}));

/**
 * PATCH /batches/:tokenId/status
 * DISTRIBUTOR_ROLE | RETAILER_ROLE — cập nhật shipment status (Phase 3)
 */
router.patch(
  "/batches/:tokenId/status",
  authenticate,
  onlyRole("DISTRIBUTOR_ROLE", "RETAILER_ROLE"),
  wrap(async (req, res) => {
    const { status, notes } = req.body;
    const batch = await prisma.batch.findUnique({ where: { tokenId: BigInt(req.params.tokenId) } });
    if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });

    // Gọi updateShipmentStatus() on-chain
    const { txHash } = await callSmartContract("updateShipmentStatus", [
      Number(batch.tokenId),
      status,
    ]);

    // Update PostgreSQL
    const updated = await prisma.batch.update({
      where: { tokenId: BigInt(req.params.tokenId) },
      data:  { currentStatus: status, updatedAt: new Date() },
      include: { producer: { include: { role: true } }, currentOwner: { include: { role: true } } },
    });

    // Tạo transfer record (append-only)
    await prisma.batchTransfer.create({
      data: {
        batchId:          batch.id,
        fromUserId:       batch.currentOwnerId,
        toUserId:         batch.currentOwnerId, // status update, không đổi owner
        statusAtTransfer: status,
        txHash,
        notes,
      },
    });

    await writeAuditTrail(req, "UPDATE_STATUS", "batch", batch.id, { status }, txHash);
    res.json(formatBatch(updated));
  })
);

/**
 * POST /batches/:tokenId/transfer
 * Current owner — chuyển ownership (Phase 3)
 */
router.post(
  "/batches/:tokenId/transfer",
  authenticate,
  wrap(async (req, res) => {
    const { toWalletAddress, notes } = req.body;
    const batch = await prisma.batch.findUnique({
      where: { tokenId: BigInt(req.params.tokenId) },
    });
    if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });
    if (batch.currentOwnerId !== req.user!.id) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Not current owner" });
    }

    // Tìm toUser theo walletAddress
    const toUser = await prisma.user.findUnique({ where: { walletAddress: toWalletAddress.toLowerCase() } });
    if (!toUser) return res.status(404).json({ code: "NOT_FOUND", message: "Recipient wallet not found" });

    // Gọi transferBatchOwnership() on-chain
    const { txHash } = await callSmartContract("transferBatchOwnership", [
      Number(batch.tokenId),
      toWalletAddress,
    ]);

    // Update owner + tạo transfer record
    const [updated] = await prisma.$transaction([
      prisma.batch.update({
        where: { id: batch.id },
        data:  { currentOwnerId: toUser.id, updatedAt: new Date() },
        include: { producer: { include: { role: true } }, currentOwner: { include: { role: true } } },
      }),
      prisma.batchTransfer.create({
        data: {
          batchId:          batch.id,
          fromUserId:       req.user!.id,
          toUserId:         toUser.id,
          verifiedOnScan:   true,
          statusAtTransfer: batch.currentStatus,
          txHash,
          notes,
        },
      }),
    ]);

    await writeAuditTrail(req, "TRANSFER_OWNERSHIP", "batch", batch.id, { toWalletAddress }, txHash);
    res.json(formatBatch(updated));
  })
);

/**
 * GET /batches/:tokenId/qr
 * PRODUCER_ROLE — lấy QR code
 */
router.get(
  "/batches/:tokenId/qr",
  authenticate,
  onlyRole("PRODUCER_ROLE"),
  wrap(async (req, res) => {
    const { format = "url" } = req.query;
    const batch = await prisma.batch.findUnique({ where: { tokenId: BigInt(req.params.tokenId) } });
    if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });

    const qrUrl = batch.qrUrl || `https://blocktrace.app/verify/${batch.tokenId}`;
    // TODO: generate QR PNG với qrcode library nếu format=png
    res.json({ qrUrl, imageData: format === "png" ? "base64-png-here" : undefined });
  })
);

// ════════════════════════════════════════════════════════════
// 3. ISSUE ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /issues
 * DISTRIBUTOR | RETAILER | INSPECTOR — báo cáo sự cố (Phase 4)
 */
router.post(
  "/issues",
  authenticate,
  onlyRole("DISTRIBUTOR_ROLE", "RETAILER_ROLE", "INSPECTOR_ROLE"),
  wrap(async (req, res) => {
    const { batchId, issueType, description, issueHash, evidenceCid } = req.body;

    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });

    // Gọi reportIssue() on-chain
    const { txHash } = await callSmartContract("reportIssue", [
      Number(batch.tokenId),
      issueHash,
      issueType,
    ]);

    // Tạo issue + chuyển batch sang UNDER_REVIEW
    const [issue] = await prisma.$transaction([
      prisma.issue.create({
        data: {
          batchId,
          reportedById: req.user!.id,
          issueType,
          description,
          issueHash,
          evidenceCid,
          reportTxHash: txHash,
          status:       "OPEN",
        },
        include: { reportedBy: { include: { role: true } } },
      }),
      prisma.batch.update({
        where: { id: batchId },
        data:  { currentStatus: "UNDER_REVIEW" },
      }),
    ]);

    await writeAuditTrail(req, "REPORT_ISSUE", "issue", issue.id, { issueType, batchId }, txHash);
    res.status(201).json(formatIssue(issue));
  })
);

/**
 * GET /issues
 * Authenticated — danh sách issues với filter + pagination
 */
router.get("/issues", authenticate, wrap(async (req, res) => {
  const { batchId, status, issueType, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (batchId)   where.batchId = batchId;
  if (status)    where.status = status;
  if (issueType) where.issueType = issueType;

  const [data, total] = await Promise.all([
    prisma.issue.findMany({
      where, skip, take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: { reportedBy: { include: { role: true } }, resolution: true },
    }),
    prisma.issue.count({ where }),
  ]);

  res.json({
    data: data.map(formatIssue),
    meta: { total, page: parseInt(page), limit: parseInt(limit), hasNext: skip + data.length < total },
  });
}));

/**
 * GET /issues/:issueId
 * Authenticated — chi tiết issue
 */
router.get("/issues/:issueId", authenticate, wrap(async (req, res) => {
  const issue = await prisma.issue.findUnique({
    where: { id: req.params.issueId },
    include: {
      reportedBy: { include: { role: true } },
      resolution: { include: { resolvedBy: { include: { role: true } } } },
    },
  });
  if (!issue) return res.status(404).json({ code: "NOT_FOUND", message: "Issue not found" });
  res.json(formatIssue(issue));
}));

/**
 * PATCH /issues/:issueId/status
 * INSPECTOR_ROLE — cập nhật trạng thái issue
 */
router.patch(
  "/issues/:issueId/status",
  authenticate,
  onlyRole("INSPECTOR_ROLE"),
  wrap(async (req, res) => {
    const { status, notes } = req.body;
    const issue = await prisma.issue.update({
      where: { id: req.params.issueId },
      data:  { status, updatedAt: new Date() },
      include: { reportedBy: { include: { role: true } }, resolution: true },
    });
    await writeAuditTrail(req, "REPORT_ISSUE", "issue", issue.id, { status, notes });
    res.json(formatIssue(issue));
  })
);

/**
 * POST /issues/:issueId/evidence
 * DISTRIBUTOR | RETAILER | INSPECTOR — upload thêm bằng chứng
 */
router.post(
  "/issues/:issueId/evidence",
  authenticate,
  onlyRole("DISTRIBUTOR_ROLE", "RETAILER_ROLE", "INSPECTOR_ROLE"),
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ code: "BAD_REQUEST", message: "File required" });

    const { cid } = await uploadToIpfs(req.file.buffer, req.file.mimetype);
    const issueHash = sha256(cid + Date.now());

    const issue = await prisma.issue.update({
      where: { id: req.params.issueId },
      data:  { evidenceCid: cid, issueHash, updatedAt: new Date() },
    });

    await writeAuditTrail(req, "UPLOAD_EVIDENCE", "issue", issue.id, { cid });
    res.json({ evidenceCid: cid, issueHash });
  })
);

// ════════════════════════════════════════════════════════════
// 4. RESOLUTION ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /issues/:issueId/resolution
 * DISPUTE_RESOLVER_ROLE — chốt xử lý + gọi resolveIssue() on-chain (Phase 5)
 */
router.post(
  "/issues/:issueId/resolution",
  authenticate,
  onlyRole("DISPUTE_RESOLVER_ROLE"),
  wrap(async (req, res) => {
    const { resolutionType, notes, settlementHash, settlementCid } = req.body;

    const issue = await prisma.issue.findUnique({ where: { id: req.params.issueId }, include: { batch: true } });
    if (!issue) return res.status(404).json({ code: "NOT_FOUND", message: "Issue not found" });

    // Gọi resolveIssue() on-chain
    const { txHash } = await callSmartContract("resolveIssue", [
      Number((issue as any).batch.tokenId),
      resolutionType,
    ]);

    // Tạo resolution + đóng issue + cập nhật batch status
    const [resolution] = await prisma.$transaction([
      prisma.resolution.create({
        data: {
          issueId:        issue.id,
          resolvedById:   req.user!.id,
          resolutionType,
          notes,
          settlementHash,
          settlementCid,
          resolveTxHash:  txHash,
        },
        include: { resolvedBy: { include: { role: true } } },
      }),
      prisma.issue.update({
        where: { id: issue.id },
        data:  { status: "RESOLVED" },
      }),
      prisma.batch.update({
        where: { id: issue.batchId },
        data:  { currentStatus: resolutionType === "RECALL" ? "RECALLED" : "RESOLVED" },
      }),
    ]);

    await writeAuditTrail(req, "RESOLVE_ISSUE", "resolution", resolution.id, { resolutionType }, txHash);
    res.status(201).json(formatResolution(resolution));
  })
);

// ════════════════════════════════════════════════════════════
// 5. INSPECTION ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /inspections
 * INSPECTOR_ROLE — tạo biên bản kiểm định (Weighted Scoring)
 */
router.post(
  "/inspections",
  authenticate,
  onlyRole("INSPECTOR_ROLE"),
  wrap(async (req, res) => {
    const { batchId, iotScore, humanScore, inspectionHash, reportCid } = req.body;

    const finalScore = ((iotScore ?? 0) * 0.5 + (humanScore ?? 0) * 0.5);
    const qualityFlag = finalScore >= 80 ? "PASS" : finalScore >= 60 ? "HOLD" : "FAIL";

    const inspection = await prisma.qualityInspection.create({
      data: {
        batchId,
        inspectorId:    req.user!.id,
        iotScore,
        humanScore,
        finalScore,
        qualityFlag,
        inspectionHash,
        reportCid,
      },
      include: { inspector: { include: { role: true } } },
    });

    res.status(201).json(formatInspection(inspection));
  })
);

/**
 * GET /inspections/batch/:tokenId
 * Authenticated — lấy tất cả inspections của một batch
 */
router.get("/inspections/batch/:tokenId", authenticate, wrap(async (req, res) => {
  const batch = await prisma.batch.findUnique({ where: { tokenId: BigInt(req.params.tokenId) } });
  if (!batch) return res.status(404).json({ code: "NOT_FOUND", message: "Batch not found" });

  const inspections = await prisma.qualityInspection.findMany({
    where:   { batchId: batch.id },
    orderBy: { inspectedAt: "desc" },
    include: { inspector: { include: { role: true } } },
  });
  res.json(inspections.map(formatInspection));
}));

/**
 * GET /inspections/:inspectionId
 * Authenticated — chi tiết inspection
 */
router.get("/inspections/:inspectionId", authenticate, wrap(async (req, res) => {
  const inspection = await prisma.qualityInspection.findUnique({
    where:   { id: req.params.inspectionId },
    include: { inspector: { include: { role: true } } },
  });
  if (!inspection) return res.status(404).json({ code: "NOT_FOUND", message: "Inspection not found" });
  res.json(formatInspection(inspection));
}));

// ════════════════════════════════════════════════════════════
// 6. ORDER ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /orders
 * Authenticated — tạo đơn hàng → sinh orderChainHash
 */
router.post("/orders", authenticate, wrap(async (req, res) => {
  const { batchId, sellerId, totalAmount, currency = "VND" } = req.body;

  const orderChainHash = sha256(JSON.stringify({ batchId, buyerId: req.user!.id, sellerId, totalAmount, ts: Date.now() }));

  const order = await prisma.order.create({
    data: {
      orderChainHash,
      batchId,
      buyerId:      req.user!.id,
      sellerId,
      totalAmount,
      currency,
      escrowStatus: "PENDING",
      orderStatus:  "PLACED",
    },
    include: { buyer: true, seller: true },
  });

  await writeAuditTrail(req, "CREATE_ORDER", "order", order.id, { batchId, totalAmount });
  res.status(201).json(formatOrder(order));
}));

/**
 * GET /orders/:orderId
 * Buyer | Seller — chi tiết đơn hàng
 */
router.get("/orders/:orderId", authenticate, wrap(async (req, res) => {
  const order = await prisma.order.findUnique({
    where:   { id: req.params.orderId },
    include: { buyer: true, seller: true, batch: true },
  });
  if (!order) return res.status(404).json({ code: "NOT_FOUND", message: "Order not found" });
  // Chỉ buyer hoặc seller được xem
  if (order.buyerId !== req.user!.id && order.sellerId !== req.user!.id) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Access denied" });
  }
  res.json(formatOrder(order));
}));

/**
 * PATCH /orders/:orderId/status
 * DISTRIBUTOR_ROLE | RETAILER_ROLE — cập nhật trạng thái đơn
 */
router.patch(
  "/orders/:orderId/status",
  authenticate,
  onlyRole("DISTRIBUTOR_ROLE", "RETAILER_ROLE"),
  wrap(async (req, res) => {
    const { status } = req.body;
    const order = await prisma.order.update({
      where:   { id: req.params.orderId },
      data:    { orderStatus: status, updatedAt: new Date() },
      include: { buyer: true, seller: true },
    });
    res.json(formatOrder(order));
  })
);

/**
 * POST /orders/:orderId/delivery-confirm
 * DISTRIBUTOR_ROLE — xác nhận giao hàng + upload PoD
 */
router.post(
  "/orders/:orderId/delivery-confirm",
  authenticate,
  onlyRole("DISTRIBUTOR_ROLE"),
  upload.single("file"),
  wrap(async (req, res) => {
    let proofOfDeliveryCid: string | undefined;
    if (req.file) {
      const { cid } = await uploadToIpfs(req.file.buffer, req.file.mimetype);
      proofOfDeliveryCid = cid;
    }

    const order = await prisma.order.update({
      where: { id: req.params.orderId },
      data:  {
        orderStatus:        "DELIVERED",
        proofOfDeliveryCid,
        deliveredAt:        new Date(),
        escrowStatus:       "HELD",
      },
      include: { buyer: true, seller: true },
    });

    res.json(formatOrder(order));
  })
);

/**
 * POST /orders/:orderId/release-fund
 * DEFAULT_ADMIN_ROLE — giải ngân cho seller
 */
router.post(
  "/orders/:orderId/release-fund",
  authenticate,
  onlyRole("DEFAULT_ADMIN_ROLE"),
  wrap(async (req, res) => {
    const order = await prisma.order.update({
      where: { id: req.params.orderId },
      data:  { escrowStatus: "RELEASED", orderStatus: "SETTLED", settledAt: new Date() },
    });

    await writeAuditTrail(req, "RELEASE_FUND", "order", order.id, {});
    res.json({ orderId: order.id, escrowStatus: "RELEASED", releasedAt: new Date().toISOString() });
  })
);

// ════════════════════════════════════════════════════════════
// 7. IPFS ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /upload/ipfs
 * Authenticated — upload file lên IPFS
 */
router.post("/upload/ipfs", authenticate, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ code: "BAD_REQUEST", message: "File required" });
  const { cid, size } = await uploadToIpfs(req.file.buffer, req.file.mimetype);
  res.json({ cid, size, url: `https://gateway.ipfs.io/ipfs/${cid.replace("ipfs://", "")}` });
}));

/**
 * GET /upload/ipfs/:cid
 * Public — fetch metadata từ IPFS cache (MongoDB)
 */
router.get("/upload/ipfs/:cid", wrap(async (req, res) => {
  const metadata = await fetchFromIpfsCache(req.params.cid);
  if (!metadata) return res.status(404).json({ code: "NOT_FOUND", message: "CID not found" });
  res.json(metadata);
}));

/**
 * POST /upload/metadata/hash
 * Authenticated — tính SHA-256 hash của metadata JSON
 */
router.post("/upload/metadata/hash", authenticate, wrap(async (req, res) => {
  const hash = sha256(JSON.stringify(req.body));
  res.json({ hash });
}));

// ════════════════════════════════════════════════════════════
// 8. BLOCKCHAIN EVENTS ROUTES
// ════════════════════════════════════════════════════════════

/**
 * GET /events/:tokenId
 * Authenticated — lấy tất cả blockchain events từ MongoDB
 */
router.get("/events/:tokenId", authenticate, wrap(async (req, res) => {
  const { eventName } = req.query;
  const { BlockchainEvent } = await import("./blocktrace_mongoose");

  const filter: any = { tokenId: parseInt(req.params.tokenId) };
  if (eventName) filter.eventName = eventName;

  const events = await BlockchainEvent.find(filter).sort({ blockNumber: 1 });
  res.json(events.map(formatEvent));
}));

/**
 * GET /events/:tokenId/timeline
 * Public — UI-ready timeline
 */
router.get("/events/:tokenId/timeline", wrap(async (req, res) => {
  const { BlockchainEvent } = await import("./blocktrace_mongoose");
  const events = await BlockchainEvent
    .find({ tokenId: parseInt(req.params.tokenId) })
    .sort({ blockNumber: 1 });

  const timeline = events.map((e, i) => ({
    step:        i + 1,
    eventName:   e.eventName,
    actor:       e.from,
    status:      e.payload?.status || null,
    txHash:      e.txHash,
    blockNumber: e.blockNumber,
    timestamp:   e.indexedAt,
  }));

  res.json(timeline);
}));

// ════════════════════════════════════════════════════════════
// 9. IOT ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /iot/logs
 * IoT Device (X-Device-Key header) — ingest sensor log
 */
router.post("/iot/logs", wrap(async (req, res) => {
  const deviceKey = req.headers["x-device-key"];
  if (!deviceKey) return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing X-Device-Key" });
  // TODO: validate deviceKey từ DB

  const { batchId, tokenId, deviceId, sensorType, value, unit, recordedAt } = req.body;

  // Tính isAnomaly dựa trên threshold (fetch từ batch config)
  const threshold = getThresholdForSensor(sensorType); // implement theo business rules
  const isAnomaly = checkAnomaly(value, threshold);

  const { IotLog } = await import("./blocktrace_mongoose");
  const log = await IotLog.create({
    batchId, tokenId, deviceId, sensorType, value, unit,
    isAnomaly, threshold,
    recordedAt: new Date(recordedAt),
    receivedAt: new Date(),
  });

  res.status(201).json(log);
}));

/**
 * GET /iot/logs/:batchId
 * INSPECTOR | DISTRIBUTOR — lấy IoT logs của batch
 */
router.get(
  "/iot/logs/:batchId",
  authenticate,
  onlyRole("INSPECTOR_ROLE", "DISTRIBUTOR_ROLE", "DEFAULT_ADMIN_ROLE"),
  wrap(async (req, res) => {
    const { sensorType, from, to } = req.query as Record<string, string>;
    const { IotLog } = await import("./blocktrace_mongoose");

    const filter: any = { batchId: req.params.batchId };
    if (sensorType) filter.sensorType = sensorType;
    if (from || to) {
      filter.recordedAt = {};
      if (from) filter.recordedAt.$gte = new Date(from);
      if (to)   filter.recordedAt.$lte = new Date(to);
    }

    const logs = await IotLog.find(filter).sort({ recordedAt: -1 });
    res.json(logs);
  })
);

/**
 * GET /iot/logs/:batchId/anomalies
 * INSPECTOR_ROLE — chỉ anomaly logs
 */
router.get(
  "/iot/logs/:batchId/anomalies",
  authenticate,
  onlyRole("INSPECTOR_ROLE"),
  wrap(async (req, res) => {
    const { IotLog } = await import("./blocktrace_mongoose");
    const logs = await IotLog.find({ batchId: req.params.batchId, isAnomaly: true }).sort({ recordedAt: -1 });
    res.json(logs);
  })
);

// ════════════════════════════════════════════════════════════
// 10. ADMIN ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /admin/roles/grant
 * DEFAULT_ADMIN_ROLE — cấp role cho user
 */
router.post(
  "/admin/roles/grant",
  authenticate,
  onlyRole("DEFAULT_ADMIN_ROLE"),
  wrap(async (req, res) => {
    const { userId, roleName } = req.body;

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return res.status(404).json({ code: "NOT_FOUND", message: "Role not found" });

    const user = await prisma.user.update({
      where:   { id: userId },
      data:    { roleId: role.id },
      include: { role: true },
    });

    // Emit RoleGranted on-chain (nếu cần)
    const { txHash } = await callSmartContract("grantRole", [role.onChainRoleHash, user.walletAddress]);

    await writeAuditTrail(req, "GRANT_ROLE", "user", userId, { roleName }, txHash);
    res.json(formatUser(user));
  })
);

/**
 * POST /admin/roles/revoke
 * DEFAULT_ADMIN_ROLE — thu hồi role
 */
router.post(
  "/admin/roles/revoke",
  authenticate,
  onlyRole("DEFAULT_ADMIN_ROLE"),
  wrap(async (req, res) => {
    const { userId, roleName } = req.body;

    // Gán về default role (CONSUMER hoặc role mặc định)
    const defaultRole = await prisma.role.findFirst({ where: { name: "AUDITOR_ROLE" } });
    const user = await prisma.user.update({
      where:   { id: userId },
      data:    { roleId: defaultRole!.id },
      include: { role: true },
    });

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    const { txHash } = await callSmartContract("revokeRole", [role?.onChainRoleHash, user.walletAddress]);

    await writeAuditTrail(req, "REVOKE_ROLE", "user", userId, { roleName }, txHash);
    res.json(formatUser(user));
  })
);

/**
 * GET /admin/audit-trail
 * DEFAULT_ADMIN_ROLE | AUDITOR_ROLE — query audit trail từ MongoDB
 */
router.get(
  "/admin/audit-trail",
  authenticate,
  onlyRole("DEFAULT_ADMIN_ROLE", "AUDITOR_ROLE"),
  wrap(async (req, res) => {
    const { actorId, action, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;
    const { AuditTrail } = await import("./blocktrace_mongoose");

    const filter: any = {};
    if (actorId) filter.actorId = actorId;
    if (action)  filter.action = action;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      AuditTrail.find(filter).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)),
      AuditTrail.countDocuments(filter),
    ]);

    res.json({
      data,
      meta: { total, page: parseInt(page), limit: parseInt(limit), hasNext: skip + data.length < total },
    });
  })
);

/**
 * POST /admin/pause
 * DEFAULT_ADMIN_ROLE — pause smart contract (emergency stop)
 */
router.post(
  "/admin/pause",
  authenticate,
  onlyRole("DEFAULT_ADMIN_ROLE"),
  wrap(async (req, res) => {
    const { txHash } = await callSmartContract("pause", []);
    await writeAuditTrail(req, "PAUSE_CONTRACT", "contract", "BlockTraceContract", {}, txHash);
    res.json({ paused: true, txHash });
  })
);

/**
 * POST /admin/unpause
 * DEFAULT_ADMIN_ROLE — unpause smart contract
 */
router.post(
  "/admin/unpause",
  authenticate,
  onlyRole("DEFAULT_ADMIN_ROLE"),
  wrap(async (req, res) => {
    const { txHash } = await callSmartContract("unpause", []);
    await writeAuditTrail(req, "UNPAUSE_CONTRACT", "contract", "BlockTraceContract", {}, txHash);
    res.json({ paused: false, txHash });
  })
);

// ════════════════════════════════════════════════════════════
// HELPERS — formatters
// ════════════════════════════════════════════════════════════
function formatUser(u: any) {
  return { id: u.id, walletAddress: u.walletAddress, name: u.name, role: u.role?.name, organization: u.organization };
}
function formatBatch(b: any) {
  return {
    ...b,
    tokenId:      Number(b.tokenId),
    producer:     b.producer ? formatUser(b.producer) : undefined,
    currentOwner: b.currentOwner ? formatUser(b.currentOwner) : undefined,
  };
}
function formatIssue(i: any) {
  return { ...i, reportedBy: i.reportedBy ? formatUser(i.reportedBy) : undefined, resolution: i.resolution ? formatResolution(i.resolution) : undefined };
}
function formatResolution(r: any) {
  return { ...r, resolvedBy: r.resolvedBy ? formatUser(r.resolvedBy) : undefined };
}
function formatInspection(i: any) {
  return {
    ...i,
    iotScore:   i.iotScore   ? Number(i.iotScore)   : null,
    humanScore: i.humanScore ? Number(i.humanScore) : null,
    finalScore: i.finalScore ? Number(i.finalScore) : null,
    inspector:  i.inspector  ? formatUser(i.inspector) : undefined,
  };
}
function formatOrder(o: any) {
  return {
    ...o,
    totalAmount: Number(o.totalAmount),
    buyer:  o.buyer  ? formatUser(o.buyer)  : undefined,
    seller: o.seller ? formatUser(o.seller) : undefined,
  };
}
function formatEvent(e: any) {
  return { tokenId: e.tokenId, batchId: e.batchId, eventName: e.eventName, txHash: e.txHash, blockNumber: e.blockNumber, from: e.from, to: e.to, payload: e.payload, indexedAt: e.indexedAt };
}

// ════════════════════════════════════════════════════════════
// HELPERS — utilities
// ════════════════════════════════════════════════════════════
async function fetchFromIpfsCache(cid: string) {
  const { IpfsMetadataCache } = await import("./blocktrace_mongoose");
  const cached = await IpfsMetadataCache.findOne({ cid });
  if (cached) return cached.metadata;
  // TODO: fetch từ IPFS gateway nếu cache miss → lưu vào cache
  return null;
}

async function writeAuditTrail(req: Request, action: string, resourceType: string, resourceId: string, payload: object, txHash?: string) {
  try {
    const { AuditTrail } = await import("./blocktrace_mongoose");
    await AuditTrail.create({
      actorId:      req.user?.id || "anonymous",
      actorWallet:  req.user?.walletAddress || "",
      actorRole:    req.user?.role || "",
      action,
      resourceType,
      resourceId,
      payload,
      txHash,
      ipAddress:    req.ip,
      userAgent:    req.headers["user-agent"],
    });
  } catch (e) {
    console.error("Audit trail write failed:", e);
  }
}

function getThresholdForSensor(sensorType: string) {
  const thresholds: Record<string, { min?: number; max?: number }> = {
    temperature: { min: 2, max: 8 },
    humidity:    { min: 60, max: 95 },
    shock:       { max: 5 },
  };
  return thresholds[sensorType] || {};
}

function checkAnomaly(value: any, threshold: { min?: number; max?: number }): boolean {
  if (typeof value !== "number") return false;
  if (threshold.min !== undefined && value < threshold.min) return true;
  if (threshold.max !== undefined && value > threshold.max) return true;
  return false;
}

// ════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ════════════════════════════════════════════════════════════
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ code: "INTERNAL_ERROR", message: err.message });
});

export default router;
