-- AlterTable
ALTER TABLE "NewsDigest"
ADD COLUMN "title" TEXT,
ADD COLUMN "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[];
