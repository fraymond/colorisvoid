-- CreateEnum
CREATE TYPE "NewsDigestStyleRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "NewsDigestFeedback" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "scoreOverall" INTEGER NOT NULL,
    "scoreHumor" INTEGER NOT NULL,
    "scoreHumanity" INTEGER NOT NULL,
    "scoreClarity" INTEGER NOT NULL,
    "scoreInsight" INTEGER NOT NULL,
    "bestLine" TEXT NOT NULL,
    "worstIssue" TEXT NOT NULL,
    "rewriteHint" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsDigestFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsDigestStyleRuleSet" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "NewsDigestStyleRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "sourceSummary" TEXT NOT NULL,
    "sourceFeedbackCount" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "moreToLeanInto" TEXT[],
    "lessToAvoid" TEXT[],
    "guardrails" TEXT[],
    "exampleWins" TEXT[],
    "exampleMisses" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "NewsDigestStyleRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsDigestGenerationMeta" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "basePromptVersion" TEXT NOT NULL,
    "ruleSetId" TEXT,
    "ruleSetVersion" INTEGER,
    "feedbackWindowSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsDigestGenerationMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsDigestFeedback_digestId_createdBy_key" ON "NewsDigestFeedback"("digestId", "createdBy");

-- CreateIndex
CREATE INDEX "NewsDigestFeedback_digestId_createdAt_idx" ON "NewsDigestFeedback"("digestId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsDigestFeedback_createdBy_createdAt_idx" ON "NewsDigestFeedback"("createdBy", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsDigestStyleRuleSet_version_key" ON "NewsDigestStyleRuleSet"("version");

-- CreateIndex
CREATE INDEX "NewsDigestStyleRuleSet_status_createdAt_idx" ON "NewsDigestStyleRuleSet"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsDigestGenerationMeta_digestId_key" ON "NewsDigestGenerationMeta"("digestId");

-- CreateIndex
CREATE INDEX "NewsDigestGenerationMeta_ruleSetId_createdAt_idx" ON "NewsDigestGenerationMeta"("ruleSetId", "createdAt");

-- AddForeignKey
ALTER TABLE "NewsDigestFeedback" ADD CONSTRAINT "NewsDigestFeedback_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "NewsDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsDigestGenerationMeta" ADD CONSTRAINT "NewsDigestGenerationMeta_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "NewsDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsDigestGenerationMeta" ADD CONSTRAINT "NewsDigestGenerationMeta_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "NewsDigestStyleRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
