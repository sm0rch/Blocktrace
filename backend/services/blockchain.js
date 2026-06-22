const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createWalletClient, createPublicClient, http, decodeEventLog } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

const BLOCKCHAIN_PROVIDER_URL = process.env.BLOCKCHAIN_PROVIDER_URL || '';
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.SMART_CONTRACT_ADDRESS || '';
const ETHERSCAN_TX_BASE = 'https://sepolia.etherscan.io/tx/';

const defaultAbiPath = path.join(
  __dirname,
  '..',
  '..',
  'hardhat',
  'artifacts',
  'contracts',
  'Counter.sol',
  'Counter.json'
);
const configuredAbiPath = (process.env.SMART_CONTRACT_ABI_PATH || '').trim().replace(/^["']|["']$/g, '');
const ABI_PATH = configuredAbiPath
  ? (path.isAbsolute(configuredAbiPath)
      ? configuredAbiPath
      : path.resolve(__dirname, '..', '..', configuredAbiPath))
  : defaultAbiPath;

let publicClient = null;
let walletClient = null;
let account = null;
let contractAbi = null;

function loadContractAbi() {
  try {
    const raw = fs.readFileSync(ABI_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    contractAbi = parsed.abi || parsed;
  } catch (error) {
    console.warn('Failed to load ABI:', error.message);
    contractAbi = [];
  }
}

function initBlockchain() {
  if (!BLOCKCHAIN_PROVIDER_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.warn('Blockchain service disabled: missing BLOCKCHAIN_PROVIDER_URL, PRIVATE_KEY or SMART_CONTRACT_ADDRESS');
    return { enabled: false };
  }

  loadContractAbi();
  if (!contractAbi || !contractAbi.length) {
    console.warn('Blockchain service disabled: contract ABI not found at', ABI_PATH);
    return { enabled: false };
  }

  const formattedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  try {
    account = privateKeyToAccount(formattedKey);
  } catch (error) {
    console.warn('Blockchain service disabled: invalid private key');
    return { enabled: false };
  }

  publicClient = createPublicClient({ chain: sepolia, transport: http(BLOCKCHAIN_PROVIDER_URL) });
  walletClient = createWalletClient({ account, chain: sepolia, transport: http(BLOCKCHAIN_PROVIDER_URL) });

  return { enabled: true };
}

function toBytes32(value, fallback = 'blocktrace') {
  const raw = String(value || fallback);
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return `0x${raw}`;
  return `0x${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

function readEventFromReceipt(receipt, eventName) {
  for (const log of receipt.logs || []) {
    try {
      const event = decodeEventLog({
        abi: contractAbi,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === eventName) return event;
    } catch {
      // Ignore logs emitted by other contracts.
    }
  }
  return null;
}

async function recordBatchOnChain(batch) {
  if (!walletClient) {
    return { success: false, message: 'Blockchain contract not initialized' };
  }

  try {
    const metadataHash = toBytes32(batch.metadata_hash, batch.tokenId);
    const metadataCID = batch.metadata_ipfs_cid || batch.tokenId || '';

    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: contractAbi,
      functionName: 'createBatch',
      args: [metadataHash, metadataCID],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const batchCreated = readEventFromReceipt(receipt, 'BatchCreated');
    const onchainBatchId = batchCreated?.args?.batchId;

    return {
      success: true,
      txHash: receipt.transactionHash,
      etherscanUrl: `${ETHERSCAN_TX_BASE}${receipt.transactionHash}`,
      onchainBatchId: onchainBatchId !== undefined ? Number(onchainBatchId) : null,
      receipt,
    };
  } catch (error) {
    console.error('Blockchain createBatch error:', error);
    return { success: false, message: error.message || 'Blockchain transaction failed' };
  }
}

async function updateCustodyOnChain(onchainBatchId, evidenceHash, note) {
  if (!walletClient) {
    return { success: false, message: 'Blockchain contract not initialized' };
  }
  if (onchainBatchId === null || onchainBatchId === undefined || onchainBatchId === '') {
    return { success: false, message: 'Missing on-chain batch id for custody update' };
  }

  try {
    const updateHash = toBytes32(evidenceHash, `${onchainBatchId}:${note || 'custody'}`);

    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: contractAbi,
      functionName: 'updateCustody',
      args: [BigInt(onchainBatchId), updateHash, note || 'Custody updated'],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      success: true,
      txHash: receipt.transactionHash,
      etherscanUrl: `${ETHERSCAN_TX_BASE}${receipt.transactionHash}`,
      receipt,
    };
  } catch (error) {
    console.error('Blockchain updateCustody error:', error);
    return { success: false, message: error.message || 'Blockchain transaction failed' };
  }
}

async function transferCustodyOnChain(onchainBatchId, toAddress = account?.address) {
  if (!walletClient) {
    return { success: false, message: 'Blockchain contract not initialized' };
  }
  if (onchainBatchId === null || onchainBatchId === undefined || onchainBatchId === '') {
    return { success: false, message: 'Missing on-chain batch id for custody transfer' };
  }
  if (!toAddress) {
    return { success: false, message: 'Missing recipient address for custody transfer' };
  }

  try {
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: contractAbi,
      functionName: 'transferCustody',
      args: [BigInt(onchainBatchId), toAddress],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      success: true,
      txHash: receipt.transactionHash,
      etherscanUrl: `${ETHERSCAN_TX_BASE}${receipt.transactionHash}`,
      receipt,
    };
  } catch (error) {
    console.error('Blockchain transferCustody error:', error);
    return { success: false, message: error.message || 'Blockchain transaction failed' };
  }
}

async function reportIssueOnChain(onchainBatchId, issueHash, issueType) {
  if (!walletClient) {
    return { success: false, message: 'Blockchain contract not initialized' };
  }
  if (onchainBatchId === null || onchainBatchId === undefined || onchainBatchId === '') {
    return { success: false, message: 'Missing on-chain batch id for issue report' };
  }

  try {
    const hash = toBytes32(issueHash, `${onchainBatchId}:${issueType || 'issue'}`);

    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: contractAbi,
      functionName: 'reportIssue',
      args: [BigInt(onchainBatchId), hash, issueType || 'Unknown'],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const issueOpened = readEventFromReceipt(receipt, 'IssueOpened');
    const onchainIssueId = issueOpened?.args?.issueId;

    return {
      success: true,
      txHash: receipt.transactionHash,
      etherscanUrl: `${ETHERSCAN_TX_BASE}${receipt.transactionHash}`,
      onchainIssueId: onchainIssueId !== undefined ? Number(onchainIssueId) : null,
      receipt,
    };
  } catch (error) {
    console.error('Blockchain reportIssue error:', error);
    return { success: false, message: error.message || 'Blockchain transaction failed' };
  }
}

function isBlockchainEnabled() {
  return !!walletClient;
}

module.exports = {
  initBlockchain,
  recordBatchOnChain,
  transferCustodyOnChain,
  updateCustodyOnChain,
  reportIssueOnChain,
  isBlockchainEnabled,
};

