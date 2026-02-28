-- Add new public guid and author fields to Story
ALTER TABLE "Story" ADD COLUMN "publicId" TEXT;
ALTER TABLE "Story" ADD COLUMN "authorEmail" TEXT;
ALTER TABLE "Story" ADD COLUMN "authorDisplayName" TEXT;

-- Unique publicId for guid URLs (nullable for backfill)
CREATE UNIQUE INDEX "Story_publicId_key" ON "Story"("publicId");

