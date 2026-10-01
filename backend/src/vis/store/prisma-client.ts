/**
 * Prisma client bootstrap for VIS.
 * Selected when VIS_DATABASE_URL is set and VIS_PERSISTENCE=prisma (default when URL present).
 */
import { PrismaClient } from '../generated/prisma';

let client: PrismaClient | null = null;

export function getVisPrisma(): PrismaClient {
  if (!client) {
    const url = process.env.VIS_DATABASE_URL;
    if (!url) {
      throw new Error('VIS_DATABASE_URL is required for Prisma persistence');
    }
    client = new PrismaClient({
      datasources: { db: { url } },
      log: process.env.VIS_PRISMA_LOG === '1' ? ['error', 'warn'] : ['error'],
    });
  }
  return client;
}

export async function disconnectVisPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

export function isPrismaPersistenceEnabled(): boolean {
  if (process.env.VIS_PERSISTENCE === 'file' || process.env.VIS_PERSISTENCE === 'memory') return false;
  if (process.env.VIS_PERSISTENCE === 'prisma') return true;
  return Boolean(process.env.VIS_DATABASE_URL);
}

export type { PrismaClient };
