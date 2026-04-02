import "dotenv/config";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const STATE_DIR = path.join(homedir(), "Library", "Application Support", "colorisvoid");
const STATE_PATH = path.join(STATE_DIR, "news-daily-state.json");
const RUN_WINDOW_END_UTC_HOUR = 6;
const ENDPOINT = "https://colorisvoid.com/api/cron/news-daily";

function utcDateString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function main() {
  const force = process.argv.includes("--force");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("Missing CRON_SECRET in environment.");
  }

  const now = new Date();
  const utcHour = now.getUTCHours();
  const today = utcDateString(now);
  const state = loadState();

  if (!force) {
    if (utcHour >= RUN_WINDOW_END_UTC_HOUR) {
      console.log(
        JSON.stringify(
          { ok: true, skipped: true, reason: "outside_utc_run_window", utcHour, today },
          null,
          2
        )
      );
      return;
    }

    if (state?.lastSuccessDate === today) {
      console.log(
        JSON.stringify(
          { ok: true, skipped: true, reason: "already_ran_today", today, state },
          null,
          2
        )
      );
      return;
    }
  }

  const response = await fetch(ENDPOINT, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`news-daily failed with ${response.status}: ${text}`);
  }

  const payload = {
    lastSuccessDate: today,
    lastRunAt: now.toISOString(),
    endpoint: ENDPOINT,
    responseStatus: response.status,
  };
  saveState(payload);

  console.log(
    JSON.stringify(
      {
        ok: true,
        force,
        today,
        payload,
        body: text,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
