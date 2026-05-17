import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatIgnitionViem from "@nomicfoundation/hardhat-ignition-viem";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxViem, hardhatIgnitionViem],
  // Thay thế chuỗi version bằng object cấu hình chi tiết để fix lỗi Stack too deep
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
});