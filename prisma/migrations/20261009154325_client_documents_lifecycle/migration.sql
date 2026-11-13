-- AlterTable
ALTER TABLE "ExerciseSession" ADD COLUMN     "documentRetentionDays" INTEGER;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "documentRetentionDays" INTEGER NOT NULL DEFAULT 14;

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "uploadedById" TEXT,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 14,
    "retainUntil" TIMESTAMP(3),
    "extractedText" TEXT,
    "extractStatus" TEXT NOT NULL DEFAULT 'pending',
    "extractError" TEXT,
    "extractPageCount" INTEGER,
    "extractTruncated" BOOLEAN NOT NULL DEFAULT false,
    "softDeletedAt" TIMESTAMP(3),
    "softDeleteReason" TEXT,
    "hardDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAuditEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "target" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientDocument_organizationId_softDeletedAt_idx" ON "ClientDocument"("organizationId", "softDeletedAt");

-- CreateIndex
CREATE INDEX "ClientDocument_sessionId_softDeletedAt_idx" ON "ClientDocument"("sessionId", "softDeletedAt");

-- CreateIndex
CREATE INDEX "ClientDocument_hardDeletedAt_retainUntil_idx" ON "ClientDocument"("hardDeletedAt", "retainUntil");

-- CreateIndex
CREATE INDEX "ClientDocument_storageKey_idx" ON "ClientDocument"("storageKey");

-- CreateIndex
CREATE INDEX "DocumentAuditEvent_organizationId_createdAt_idx" ON "DocumentAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAuditEvent_documentId_createdAt_idx" ON "DocumentAuditEvent"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAuditEvent_sessionId_createdAt_idx" ON "DocumentAuditEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAuditEvent_action_createdAt_idx" ON "DocumentAuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditEvent" ADD CONSTRAINT "DocumentAuditEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClientDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditEvent" ADD CONSTRAINT "DocumentAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditEvent" ADD CONSTRAINT "DocumentAuditEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditEvent" ADD CONSTRAINT "DocumentAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
