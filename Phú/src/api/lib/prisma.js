import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

let prismaClient = null;

export function shouldSyncOffchain() {
  return process.env.SYNC_OFFCHAIN === "true";
}

function getPrismaClient() {
  if (!prismaClient) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when SYNC_OFFCHAIN=true");
    }
    const adapter = new PrismaMssql(process.env.DATABASE_URL);
    prismaClient = new PrismaClient({ adapter });
  }
  return prismaClient;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      return getPrismaClient()[property];
    },
  },
);

export async function tryOffchainSync(action) {
  if (!shouldSyncOffchain()) {
    return { synced: false, reason: "SYNC_OFFCHAIN is not true" };
  }

  try {
    const data = await action();
    return { synced: true, data };
  } catch (error) {
    return { synced: false, error: error.message };
  }
}
