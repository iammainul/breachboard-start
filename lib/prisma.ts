import { PrismaClient } from "@prisma/client";

const APPEND_ONLY = "DocumentAuditEvent is append-only";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrisma> };

function createPrisma() {
  const client = new PrismaClient();
  return client.$extends({
    name: "document-audit-append-only",
    query: {
      documentAuditEvent: {
        async update() {
          throw new Error(APPEND_ONLY);
        },
        async updateMany() {
          throw new Error(APPEND_ONLY);
        },
        async delete() {
          throw new Error(APPEND_ONLY);
        },
        async deleteMany() {
          throw new Error(APPEND_ONLY);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
