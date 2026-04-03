-- CreateEnum
CREATE TYPE "DigestVersionStatus" AS ENUM ('DRAFT', 'FINAL', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWritingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'markdown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWritingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTopicSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'markdown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTopicSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsDigestVersion" (
    "id" TEXT NOT NULL,
    "digestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "script" TEXT NOT NULL,
    "status" "DigestVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "pickedIds" TEXT[],
    "createdBy" TEXT NOT NULL,
    "rewriteNote" TEXT,
    "model" TEXT,
    "skillSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsDigestVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_active_sortOrder_idx" ON "Topic"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserWritingProfile_userId_key" ON "UserWritingProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopicSkill_userId_topicId_key" ON "UserTopicSkill"("userId", "topicId");

-- CreateIndex
CREATE INDEX "UserTopicSkill_topicId_idx" ON "UserTopicSkill"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsDigestVersion_digestId_version_key" ON "NewsDigestVersion"("digestId", "version");

-- CreateIndex
CREATE INDEX "NewsDigestVersion_digestId_status_idx" ON "NewsDigestVersion"("digestId", "status");

-- CreateIndex
CREATE INDEX "NewsDigestVersion_createdBy_createdAt_idx" ON "NewsDigestVersion"("createdBy", "createdAt");

-- AddForeignKey
ALTER TABLE "UserWritingProfile" ADD CONSTRAINT "UserWritingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopicSkill" ADD CONSTRAINT "UserTopicSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopicSkill" ADD CONSTRAINT "UserTopicSkill_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsDigestVersion" ADD CONSTRAINT "NewsDigestVersion_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "NewsDigest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on new tables
ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserWritingProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserTopicSkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsDigestVersion" ENABLE ROW LEVEL SECURITY;

-- Seed the initial AI News topic
INSERT INTO "Topic" ("id", "slug", "name", "description", "icon", "active", "sortOrder", "createdAt", "updatedAt")
VALUES (
    'topic_ai_news',
    'ai-news',
    'AI News',
    '献哥AI报道 — Daily AI news digest in Xian Ge style',
    '📡',
    true,
    0,
    NOW(),
    NOW()
);
