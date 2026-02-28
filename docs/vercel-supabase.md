# Deploy to Vercel + Supabase

This project is designed for:

- **Vercel** (Next.js hosting)
- **Supabase Postgres** (stories + auth data)
- **Supabase Storage** (article images)

## 1) Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. In Project Settings > Database:
   - Copy **Connection string** (URI) and **Connection pooling** URI
   - **Direct connection** (port 5432): for `prisma migrate`
   - **Connection pooling** (port 6543): for app runtime
3. Enable **Supabase Storage**; create a **public** bucket named `stories` for article images
4. In Project Settings > API: copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for server-side storage uploads)

## 2) Environment Variables

Configure these in Vercel (Project Settings > Environment Variables):

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Supabase **Connection pooling** URI (port 6543) |
| `DIRECT_DATABASE_URL` | Supabase **Direct connection** URI (port 5432) |
| `NEXTAUTH_URL` | `https://colorisvoid.com` |
| `NEXTAUTH_SECRET` | Keep existing |
| `ADMIN_EMAILS` | Keep existing |
| `ADMIN_EMAIL_DOMAIN` | Optional |
| `ADMIN_WECHAT_OPENIDS` | Optional |
| `ADMIN_META_IDS` | Optional |
| `GOOGLE_CLIENT_ID` | Keep existing |
| `GOOGLE_CLIENT_SECRET` | Keep existing |
| `FACEBOOK_CLIENT_ID` | Optional |
| `FACEBOOK_CLIENT_SECRET` | Optional |
| `WECHAT_CLIENT_ID` | Optional |
| `WECHAT_CLIENT_SECRET` | Optional |
| `OPENAI_API_KEY` | Keep existing |
| `OPENAI_MODEL` | Optional |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## 3) Migrations on Deploy

Vercel runs `vercel-build` (defined in `package.json`) which executes `prisma migrate deploy` before `next build`. Migrations run automatically on each production deploy.

## 4) Vercel Deployment

1. Push code to GitHub; connect the repo in Vercel
2. Configure env vars in Vercel (Project Settings > Environment Variables)
3. Add custom domain: `colorisvoid.com` and `www.colorisvoid.com`
4. Deploy; Vercel will run `vercel-build` (migrate + build)

## 5) Domain Migration

### Option A: Use Vercel DNS (recommended)

1. In Vercel: Project Settings > Domains > Add `colorisvoid.com` and `www.colorisvoid.com`
2. At your domain registrar: change nameservers to Vercel's (e.g. `ns1.vercel-dns.com`, `ns2.vercel-dns.com`)
3. Vercel provisions Let's Encrypt certificates automatically

### Option B: Keep existing DNS

1. Add domains in Vercel; Vercel shows required records
2. At Cloud DNS or your registrar, add:
   - **Apex (`colorisvoid.com`)**: A record → `76.76.21.21`
   - **www**: CNAME `www` → `cname.vercel-dns.com`
3. Remove old Cloud Run A/CNAME records
4. Vercel auto-provisions certs once DNS validates

### OAuth Callback URLs

After domain migration, ensure OAuth providers allow `https://colorisvoid.com`:

- **Google**: `https://colorisvoid.com/api/auth/callback/google`
- **Meta/Facebook**: App Domains and Valid OAuth Redirect URIs
- **WeChat**: `https://colorisvoid.com/api/auth/callback/wechat`

`NEXTAUTH_URL` must remain `https://colorisvoid.com` in Vercel env vars.

## 6) Existing GCS Images

Stories may reference `https://storage.googleapis.com/...` URLs:

- **Option A**: Leave as-is; old images stay on GCS, new uploads go to Supabase
- **Option B**: Migrate images to Supabase Storage and update `body` Markdown URLs in the database

Recommend **A** for minimal migration.

## Notes

- Admin access is controlled by allowlist env vars (`ADMIN_EMAILS`, `ADMIN_EMAIL_DOMAIN`, etc.)
- OAuth provider setup requires proper callback URLs at the provider side (Google/Meta/WeChat).
- Vercel preview deployments use `*.vercel.app`; canonical redirect applies only to `www.colorisvoid.com` → `colorisvoid.com`.
