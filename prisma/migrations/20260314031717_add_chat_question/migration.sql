-- CreateTable
CREATE TABLE "ChatQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatQuestion_createdAt_idx" ON "ChatQuestion"("createdAt");
