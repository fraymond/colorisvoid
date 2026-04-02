-- Harden Supabase/PostgREST access for Prisma-managed tables in the public schema.
-- The application uses direct server-side Postgres access via Prisma, so anon/authenticated
-- should not have blanket table privileges.

-- Revoke broad table/sequence access from Supabase API roles.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Prevent future Prisma-created tables/sequences from inheriting public API access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Enable row-level security on every Prisma-managed table.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsDigest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsDigestFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsDigestStyleRuleSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsDigestGenerationMeta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies are created here on purpose.
-- If direct Supabase table access is needed in the future, add explicit policies and grants
-- for the minimum required operations in a follow-up migration.
