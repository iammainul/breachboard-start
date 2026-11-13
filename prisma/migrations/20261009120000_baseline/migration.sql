-- Baseline migration matching prisma/schema.prisma (includes InjectAnswer.needsReview).
-- Generated with: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- Existing prisma db push databases: prisma migrate resolve --applied 20261009120000_baseline

-- CreateEnum
CREATE TYPE "FeedSource" AS ENUM ('CISA', 'FBI', 'RBI', 'SEBI', 'CERT_IN', 'NVD', 'MANUAL', 'NEWS');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT 'bfsi_in',
    "notes" TEXT NOT NULL DEFAULT '',
    "crisisDocPath" TEXT,
    "crisisDocName" TEXT,
    "ircDocPath" TEXT,
    "ircDocName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "platformRole" TEXT NOT NULL DEFAULT 'USER',
    "canFacilitate" BOOLEAN NOT NULL DEFAULT false,
    "authEpoch" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "preferredRole" TEXT,
    "preferredTeam" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackTactic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortname" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AttackTactic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackTechnique" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tacticId" TEXT,
    "isSubtechnique" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,

    CONSTRAINT "AttackTechnique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "description" TEXT NOT NULL,

    CONSTRAINT "AttackGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackGroupTechnique" (
    "groupId" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,

    CONSTRAINT "AttackGroupTechnique_pkey" PRIMARY KEY ("groupId","techniqueId")
);

-- CreateTable
CREATE TABLE "CveRecord" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cvss" DOUBLE PRECISION,
    "kev" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "raw" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "source" "FeedSource" NOT NULL,
    "publisher" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "cveIds" TEXT[],
    "groupIds" TEXT[],
    "techniqueIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectionPlaybook" (
    "id" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logSource" TEXT,
    "alertName" TEXT,
    "d3fendId" TEXT,
    "description" TEXT NOT NULL,

    CONSTRAINT "DetectionPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 90,
    "sector" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "document" JSONB NOT NULL,
    "lineageKey" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateKey" TEXT,
    "libraryKind" TEXT NOT NULL DEFAULT 'scenario_pack',
    "libraryTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImagePath" TEXT,
    "cloneCount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseClient" (
    "exerciseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseClient_pkey" PRIMARY KEY ("exerciseId","organizationId")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ExerciseSession" (
    "id" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "runKind" TEXT NOT NULL DEFAULT 'engagement',
    "organizationId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "currentInjectId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'idle',
    "currentInjectStartedAt" TIMESTAMP(3),
    "injectTeamPlan" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reportSnapshot" JSONB,
    "reportGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SessionTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSeat" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "playbookRoleId" TEXT,
    "teamId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InjectAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "injectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playbookRoleId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "autoPoints" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "aiNotes" TEXT,
    "overrideComment" TEXT,
    "overriddenById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InjectAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRoleInvite" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playbookRoleId" TEXT,
    "teamId" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "token" TEXT,
    "tokenHash" TEXT,
    "tokenHint" TEXT,
    "expiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "deliveryError" TEXT,
    "createdByUserId" TEXT,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRoleInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OrgAssignment_userId_idx" ON "OrgAssignment"("userId");

-- CreateIndex
CREATE INDEX "OrgAssignment_organizationId_idx" ON "OrgAssignment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgAssignment_userId_organizationId_key" ON "OrgAssignment"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_templateKey_key" ON "Exercise"("templateKey");

-- CreateIndex
CREATE INDEX "Exercise_isTemplate_idx" ON "Exercise"("isTemplate");

-- CreateIndex
CREATE INDEX "Exercise_organizationId_lineageKey_idx" ON "Exercise"("organizationId", "lineageKey");

-- CreateIndex
CREATE INDEX "ExerciseClient_organizationId_idx" ON "ExerciseClient"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSession_joinCode_key" ON "ExerciseSession"("joinCode");

-- CreateIndex
CREATE INDEX "SessionTeam_sessionId_idx" ON "SessionTeam"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTeam_sessionId_name_key" ON "SessionTeam"("sessionId", "name");

-- CreateIndex
CREATE INDEX "SessionTeamMember_userId_idx" ON "SessionTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTeamMember_teamId_userId_key" ON "SessionTeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSeat_sessionId_userId_key" ON "SessionSeat"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InjectAnswer_sessionId_injectId_userId_key" ON "InjectAnswer"("sessionId", "injectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRoleInvite_tokenHash_key" ON "SessionRoleInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "SessionRoleInvite_sessionId_idx" ON "SessionRoleInvite"("sessionId");

-- CreateIndex
CREATE INDEX "SessionRoleInvite_sessionId_status_idx" ON "SessionRoleInvite"("sessionId", "status");

-- CreateIndex
CREATE INDEX "SessionRoleInvite_recipientEmail_idx" ON "SessionRoleInvite"("recipientEmail");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAssignment" ADD CONSTRAINT "OrgAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAssignment" ADD CONSTRAINT "OrgAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackTechnique" ADD CONSTRAINT "AttackTechnique_tacticId_fkey" FOREIGN KEY ("tacticId") REFERENCES "AttackTactic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackGroupTechnique" ADD CONSTRAINT "AttackGroupTechnique_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AttackGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackGroupTechnique" ADD CONSTRAINT "AttackGroupTechnique_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "AttackTechnique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectionPlaybook" ADD CONSTRAINT "DetectionPlaybook_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "AttackTechnique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseClient" ADD CONSTRAINT "ExerciseClient_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseClient" ADD CONSTRAINT "ExerciseClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSession" ADD CONSTRAINT "ExerciseSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSession" ADD CONSTRAINT "ExerciseSession_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTeam" ADD CONSTRAINT "SessionTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTeamMember" ADD CONSTRAINT "SessionTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SessionTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTeamMember" ADD CONSTRAINT "SessionTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSeat" ADD CONSTRAINT "SessionSeat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSeat" ADD CONSTRAINT "SessionSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSeat" ADD CONSTRAINT "SessionSeat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SessionTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjectAnswer" ADD CONSTRAINT "InjectAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjectAnswer" ADD CONSTRAINT "InjectAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRoleInvite" ADD CONSTRAINT "SessionRoleInvite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

