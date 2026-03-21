import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

  // Validate env
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!dbUrl) {
    console.error("Missing DIRECT_DATABASE_URL or DATABASE_URL");
    process.exit(1);
  }

  // 1. Create stories bucket
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error: bucketError } = await supabase.storage.createBucket("stories", {
    public: true,
  });
  if (bucketError) {
    if (bucketError.message?.includes("already exists")) {
      console.log("Bucket 'stories' already exists");
    } else {
      throw bucketError;
    }
  } else {
    console.log("Created bucket 'stories'");
  }

  // 2. Run migrations
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DIRECT_DATABASE_URL: dbUrl },
  });
  console.log("Migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
