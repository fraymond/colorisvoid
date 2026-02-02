/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { Client } = require("pg");

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    VARCHAR(36) PRIMARY KEY,
      "checksum"              VARCHAR(64) NOT NULL,
      "finished_at"           TIMESTAMPTZ,
      "migration_name"        VARCHAR(255) NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        TIMESTAMPTZ,
      "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    );
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS "_prisma_migrations_migration_name_idx" ON "_prisma_migrations" ("migration_name");`
  );
}

async function hasMigration(client, name) {
  const res = await client.query(
    `SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "rolled_back_at" IS NULL LIMIT 1`,
    [name]
  );
  return res.rowCount > 0;
}

function uuidV4() {
  // RFC4122 v4
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

async function applyOne(client, migrationDir) {
  const migrationName = path.basename(migrationDir);
  const sqlPath = path.join(migrationDir, "migration.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const checksum = sha256(sql);

  if (await hasMigration(client, migrationName)) {
    console.log(`skip ${migrationName}`);
    return;
  }

  const id = uuidV4();
  await client.query(
    `INSERT INTO "_prisma_migrations" ("id","checksum","migration_name","started_at","applied_steps_count") VALUES ($1,$2,$3,now(),0)`,
    [id, checksum, migrationName]
  );

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    await client.query(
      `UPDATE "_prisma_migrations" SET "finished_at"=now(), "applied_steps_count"=1 WHERE "id"=$1`,
      [id]
    );
    console.log(`applied ${migrationName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    await client.query(
      `UPDATE "_prisma_migrations" SET "logs"=$2 WHERE "id"=$1`,
      [id, String(err && err.stack ? err.stack : err)]
    );
    throw err;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing DATABASE_URL");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
    const dirs = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(migrationsRoot, d.name))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

    for (const dir of dirs) {
      // eslint-disable-next-line no-await-in-loop
      await applyOne(client, dir);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

