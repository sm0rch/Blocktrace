import * as svc from "../services/contract.service.js";

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({
        success: false,
        error: error.message,
      });
    }
  };
}

export const batchController = {
  createBatch: asyncHandler(async (req, res) => {
    const data = await svc.createBatch(req.body);
    res.status(201).json({ success: true, data });
  }),

  getBatch: asyncHandler(async (req, res) => {
    const data = await svc.getBatchDetail(req.params.tokenId, req.query);
    res.json({ success: true, data });
  }),

  transferCustody: asyncHandler(async (req, res) => {
    const data = await svc.transferCustody({ tokenId: req.params.tokenId, ...req.body });
    res.json({ success: true, data });
  }),

  updateCustody: asyncHandler(async (req, res) => {
    const data = await svc.updateCustody({ tokenId: req.params.tokenId, ...req.body });
    res.json({ success: true, data });
  }),
};

export const issueController = {
  reportIssue: asyncHandler(async (req, res) => {
    const data = await svc.reportIssue(req.body);
    res.status(201).json({ success: true, data });
  }),

  getIssue: asyncHandler(async (req, res) => {
    const data = await svc.getIssueDetail(req.params.issueId);
    res.json({ success: true, data });
  }),

  anchorEvidence: asyncHandler(async (req, res) => {
    const data = await svc.anchorEvidence({ issueId: req.params.issueId, ...req.body });
    res.json({ success: true, data });
  }),

  confirmResolution: asyncHandler(async (req, res) => {
    const data = await svc.confirmResolution({ issueId: req.params.issueId, ...req.body });
    res.json({ success: true, data });
  }),

  resolveIssue: asyncHandler(async (req, res) => {
    const data = await svc.resolveIssue({ issueId: req.params.issueId, ...req.body });
    res.json({ success: true, data });
  }),
};

export const paymentController = {
  lockPayment: asyncHandler(async (req, res) => {
    const data = await svc.lockPayment(req.body);
    res.status(201).json({ success: true, data });
  }),

  releasePayment: asyncHandler(async (req, res) => {
    const data = await svc.releasePayment({ tokenId: req.params.tokenId, ...req.body });
    res.json({ success: true, data });
  }),

  getEscrow: asyncHandler(async (req, res) => {
    const data = await svc.getEscrowDetail(req.params.tokenId);
    res.json({ success: true, data });
  }),
};
