import { PrismaClient } from "@prisma/client";

/**
 * Standard Next.js + Prisma singleton — without this, every hot-reload in
 * dev mode would create a fresh PrismaClient (and a fresh pool of DB
 * connections) on top of the last one until the DB refuses new
 * connections. Server-only: never imported from a "use client" file.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
