import "dotenv/config";
import express from "express";
import { contractAddress, rpcUrl } from "./config/blockchain.js";
import { router } from "./routes/index.js";

const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    rpcUrl,
    contractAddress: contractAddress ?? null,
    offchainSync: process.env.SYNC_OFFCHAIN === "true",
  });
});

app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    success: false,
    error: error.message,
  });
});

app.listen(port, () => {
  console.log(`BlockTrace API listening on http://localhost:${port}`);
});
