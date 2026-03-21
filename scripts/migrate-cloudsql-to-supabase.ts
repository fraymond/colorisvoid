/**
 * Migrate data from Google Cloud SQL to Supabase.
 *
 * Prerequisites:
 * - Cloud SQL: Run Cloud SQL Proxy or have direct access
 *   cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5433
 * - Set CLOUD_SQL_DATABASE_URL (source) and DIRECT_DATABASE_URL (target Supabase)
 *
 * Usage: npm run migrate:cloudsql-to-supabase
 */

import "dotenv/config";
import { Client } from "pg";

const sourceUrl = process.env.CLOUD_SQL_DATABASE_URL;
const targetUrl =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!sourceUrl) {
  console.error("Missing CLOUD_SQL_DATABASE_URL");
  process.exit(1);
}
if (!targetUrl) {
  console.error("Missing DIRECT_DATABASE_URL or DATABASE_URL");
  process.exit(1);
}

// Insert order: User first (no deps), then Account/Session/VerificationToken (depend on User), then Story
const TABLES: { name: string; conflictTarget: string }[] = [
  { name: "User", conflictTarget: "(id)" },
  { name: "Account", conflictTarget: "(id)" },
  { name: "Session", conflictTarget: "(id)" },
  { name: "VerificationToken", conflictTarget: "(identifier, token)" },
  { name: "Story", conflictTarget: "(id)" },
];

async function migrate() {
  const source = new Client({ connectionString: sourceUrl });
  const target = new Client({ connectionString: targetUrl });

  try {
    await source.connect();
    await target.connect();
    console.log("Connected to source and target. Migrating...");

    for (const { name: table, conflictTarget } of TABLES) {
      const { rows } = await source.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (skip)`);
        continue;
      }

      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT ${conflictTarget} DO NOTHING`;

      let inserted = 0;
      for (const row of rows) {
        const values = cols.map((c) => row[c]);
        const res = await target.query(sql, values);
        if (res.rowCount && res.rowCount > 0) inserted++;
      }
      console.log(`  ${table}: ${rows.length} rows, ${inserted} inserted`);
    }

    console.log("Migration complete.");
  } finally {
    await source.end();
    await target.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
