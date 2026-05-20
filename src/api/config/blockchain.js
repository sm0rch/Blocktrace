import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactPath = resolve(__dirname, "../../../artifacts/contracts/Counter.sol/Counter.json");
const counterArtifact = JSON.parse(readFileSync(artifactPath, "utf8"));

export const counterAbi = counterArtifact.abi;
export const contractAddress = process.env.CONTRACT_ADDRESS;
export const rpcUrl = process.env.RPC_URL ?? process.env.SEPOLIA_RPC_URL ?? "http://127.0.0.1:8545";
export const chainId = Number(process.env.CHAIN_ID ?? (process.env.SEPOLIA_RPC_URL && !process.env.RPC_URL ? 11155111 : 31337));

export const chain = defineChain({
  id: chainId,
  name: chainId === 11155111 ? "Sepolia" : "Local Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

export const BatchStatus = {
  0: "Minted",
  1: "InTransit",
  2: "Delivered",
  3: "UnderReview",
  4: "Recalled",
  5: "Cleared",
};

export const IssueStatus = {
  0: "Open",
  1: "UnderReview",
  2: "Resolved",
  3: "Recalled",
};

export const ResolutionType = {
  None: 0,
  Cleared: 1,
  Refund: 2,
  RefundPartial: 3,
  Replaced: 4,
  Recalled: 5,
};

export const EscrowStatus = {
  0: "None",
  1: "Locked",
  2: "Released",
  3: "Refunded",
  4: "PartiallyRefunded",
};

const rolePrivateKeyEnv = {
  admin: "ADMIN_PRIVATE_KEY",
  producer: "PRODUCER_PRIVATE_KEY",
  distributor: "DISTRIBUTOR_PRIVATE_KEY",
  retailer: "RETAILER_PRIVATE_KEY",
  inspector: "INSPECTOR_PRIVATE_KEY",
  resolver: "RESOLVER_PRIVATE_KEY",
};

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

function normalizePrivateKey(privateKey) {
  if (!privateKey) return null;
  return privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
}

export function getAccount(role = "admin", privateKey) {
  const envKey = rolePrivateKeyEnv[role] ?? "PRIVATE_KEY";
  const key = normalizePrivateKey(privateKey ?? process.env[envKey] ?? process.env.PRIVATE_KEY);
  if (!key) {
    throw new Error(`Missing private key for role "${role}". Set ${envKey} or PRIVATE_KEY.`);
  }
  return privateKeyToAccount(key);
}

export function getWalletClient(role = "admin", privateKey) {
  return createWalletClient({
    account: getAccount(role, privateKey),
    chain,
    transport: http(rpcUrl),
  });
}

export function requireContractAddress() {
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not configured in .env");
  }
  return contractAddress;
}

export async function readCounter(functionName, args = []) {
  return publicClient.readContract({
    address: requireContractAddress(),
    abi: counterAbi,
    functionName,
    args,
  });
}

export async function writeCounter({ role, privateKey, functionName, args = [], value }) {
  const walletClient = getWalletClient(role, privateKey);
  const hash = await walletClient.writeContract({
    address: requireContractAddress(),
    abi: counterAbi,
    functionName,
    args,
    value,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt, account: walletClient.account.address };
}

export function findEvent(receipt, eventName) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: counterAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === eventName) return decoded;
    } catch {
      // Ignore logs emitted by other contracts.
    }
  }
  return null;
}

export function toJsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item)),
  );
}
