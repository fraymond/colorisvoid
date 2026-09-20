import type { ProsodyParagraph } from "@/app/generated/prisma/client";

// app.js's timeAgo() parses created_at as SQLite's "YYYY-MM-DD HH:MM:SS"
// (space-separated, no offset) and does `iso.replace(" ", "T") + "Z"` --
// serialize createdAt to match that exact shape rather than a full ISO string.
function toSqliteTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

export function serializeParagraph(row: ProsodyParagraph) {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    language: row.language,
    created_at: toSqliteTimestamp(row.createdAt),
  };
}
