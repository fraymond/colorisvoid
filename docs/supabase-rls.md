# Supabase RLS Hardening

This project stores application tables in the Postgres `public` schema through Prisma migrations.
The intended runtime access pattern is:

- App database access: server-side Prisma over `DATABASE_URL`
- Storage access: server-side Supabase client with `SUPABASE_SERVICE_ROLE_KEY`
- Direct Supabase table API access from browsers or public clients: not used

## What Was Wrong

The live Supabase project was audited and showed:

- RLS disabled on every Prisma-managed table in `public`
- No policies in `pg_policies`
- Broad `anon` and `authenticated` grants on the tables

That means the following warnings were effectively true in the live project at audit time:

- `Table publicly accessible`
- `Sensitive data publicly accessible`

## Table Classification

Current policy choice: all Prisma-managed tables are treated as server-only.

### Must Remain Server-Only

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `Story`
- `ChatQuestion`
- `NewsItem`
- `NewsDigest`
- `NewsDigestFeedback`
- `NewsDigestStyleRuleSet`
- `NewsDigestGenerationMeta`
- `_prisma_migrations`

Why:

- Auth tables contain personal identifiers, sessions, and OAuth tokens.
- Editorial tables contain drafts, internal prompts, private feedback, or pipeline metadata.
- Public site reads already happen through Next.js server code and Prisma, so no direct Supabase table exposure is required.

## Implemented Hardening

Migration:

- [`/Users/rfu/git/colorisvoid/prisma/migrations/20260331214000_harden_public_schema_rls/migration.sql`](/Users/rfu/git/colorisvoid/prisma/migrations/20260331214000_harden_public_schema_rls/migration.sql)

This migration:

- revokes blanket table and sequence privileges from `anon` and `authenticated`
- revokes default privileges for future tables and sequences in `public`
- enables RLS on every Prisma-managed table
- intentionally creates no public policies

## Why This Does Not Break The App

Current server DB access uses Prisma with `DATABASE_URL`:

- [`/Users/rfu/git/colorisvoid/app/lib/prisma.ts`](/Users/rfu/git/colorisvoid/app/lib/prisma.ts)

The live audit showed the current database connection user is `postgres`, and that role has `rolbypassrls = true`.
That means server-side Prisma continues to work even after RLS is enabled.

Service-role usage is limited to server-side storage/setup paths:

- [`/Users/rfu/git/colorisvoid/app/api/admin/images/route.ts`](/Users/rfu/git/colorisvoid/app/api/admin/images/route.ts)
- [`/Users/rfu/git/colorisvoid/scripts/setup-supabase.ts`](/Users/rfu/git/colorisvoid/scripts/setup-supabase.ts)

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

## Future Safe Pattern

If you later want direct Supabase table access from the client, do not re-open blanket grants.
Instead:

1. Keep RLS enabled.
2. Re-grant only the minimum required privilege on the specific table.
3. Add one explicit policy for the exact allowed action.
4. Prefer read-only exposure for public content only.

For example, if you ever want direct client reads for published stories, create a dedicated migration that:

- grants `SELECT` on `Story` to `anon` and/or `authenticated`
- adds a policy limited to `status = 'PUBLISHED'`

## Validation Queries

Use these checks after deployment:

```sql
select n.nspname as schema, c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
order by c.relname;
```

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```
