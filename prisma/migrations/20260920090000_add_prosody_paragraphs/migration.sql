-- CreateTable
CREATE TABLE "prosody_paragraphs" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prosody_paragraphs_pkey" PRIMARY KEY ("id")
);

-- Match the RLS hardening in 20260331214000_harden_public_schema_rls: this
-- table is only ever read/written through Prisma's direct Postgres
-- connection, never through the Supabase PostgREST API.
ALTER TABLE "prosody_paragraphs" ENABLE ROW LEVEL SECURITY;
