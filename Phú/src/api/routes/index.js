import { Router } from "express";
import {
  batchController,
  issueController,
  paymentController,
} from "../controllers/index.js";

export const router = Router();

router.post("/batches", batchController.createBatch);
router.get("/batches/:tokenId", batchController.getBatch);
router.post("/batches/:tokenId/transfer", batchController.transferCustody);
router.post("/batches/:tokenId/custody-log", batchController.updateCustody);

router.post("/issues", issueController.reportIssue);
router.get("/issues/:issueId", issueController.getIssue);
router.post("/issues/:issueId/evidence", issueController.anchorEvidence);
router.post("/issues/:issueId/confirm", issueController.confirmResolution);
router.post("/issues/:issueId/resolve", issueController.resolveIssue);

router.post("/payments/lock", paymentController.lockPayment);
router.post("/payments/:tokenId/release", paymentController.releasePayment);
router.get("/payments/:tokenId/escrow", paymentController.getEscrow);
