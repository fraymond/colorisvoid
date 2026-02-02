# Deploy to Google Cloud (Cloud Run + Cloud SQL)

This project is designed for:

- Cloud Run (container)
- Cloud SQL for PostgreSQL (stories + auth data)
- Secret Manager (OpenAI key + OAuth secrets + allowlist)

## 1) Create Cloud SQL (Postgres)

- Create a Cloud SQL Postgres instance and a database (e.g. `colorisvoid`).
- Create a database user.

## 2) Create secrets

Store these in Secret Manager:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your final domain)
- `DATABASE_URL`
- `ADMIN_EMAILS` / `ADMIN_EMAIL_DOMAIN`
- OAuth secrets:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
  - `WECHAT_CLIENT_ID`, `WECHAT_CLIENT_SECRET`

## 3) DATABASE_URL for Cloud SQL (recommended format)

With Cloud Run + Cloud SQL connector, use a Unix socket host:

`postgresql://USER:PASSWORD@localhost/colorisvoid?host=/cloudsql/INSTANCE_CONNECTION_NAME`

## 4) Build + deploy (high level)

1) Build container:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/REPO/colorisvoid
```

2) Deploy to Cloud Run and attach Cloud SQL instance:

```bash
gcloud run deploy colorisvoid \
  --image REGION-docker.pkg.dev/PROJECT/REPO/colorisvoid \
  --region REGION \
  --add-cloudsql-instances INSTANCE_CONNECTION_NAME \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
  --set-secrets "NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest" \
  --set-secrets "NEXTAUTH_URL=NEXTAUTH_URL:latest" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

Add the rest of secrets the same way (`--set-secrets ...`).

## 5) Run migrations

Run Prisma migrations against your production `DATABASE_URL`.
You can do this from a secure environment (e.g. Cloud Build step or your workstation with access):

```bash
npx prisma migrate deploy
```

## Notes

- Admin access is controlled by allowlist env vars (`ADMIN_EMAILS`, `ADMIN_EMAIL_DOMAIN`, etc).
- OAuth provider setup also requires proper callback URLs at the provider side (Google/Meta/WeChat).
