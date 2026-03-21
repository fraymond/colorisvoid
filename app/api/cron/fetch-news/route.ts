import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { XMLParser } from "fast-xml-parser";

import { prisma } from "@/app/lib/prisma";

const RSS_FEEDS = [
  { url: "https://planet-ai.net/rss.xml", name: "planet-ai" },
  {
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    name: "techcrunch",
  },
];

const parser = new XMLParser({ ignoreAttributes: false });

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

interface FeedItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  "dc:date"?: string;
}

async function fetchFeed(
  url: string,
  sourceName: string
): Promise<
  { sourceUrl: string; title: string; summary: string | null; sourceName: string; publishedAt: Date }[]
> {
  const res = await fetch(url, {
    headers: { "User-Agent": "colorisvoid-news-bot/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  const rawItems: FeedItem[] = channel?.item ?? parsed?.feed?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const results: {
    sourceUrl: string;
    title: string;
    summary: string | null;
    sourceName: string;
    publishedAt: Date;
  }[] = [];

  for (const item of items) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const link = typeof item.link === "string" ? item.link.trim() : "";
    if (!title || !link) continue;

    const pubDate = parseDate(item.pubDate ?? item["dc:date"]);
    if (!pubDate) continue;

    const summary = item.description ? stripHtml(String(item.description)).slice(0, 1000) : null;

    results.push({ sourceUrl: link, title, summary, sourceName, publishedAt: pubDate });
  }

  return results;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let totalInserted = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const items = await fetchFeed(feed.url, feed.name);
      for (const item of items) {
        try {
          await prisma.newsItem.upsert({
            where: { sourceUrl: item.sourceUrl },
            create: item,
            update: {},
          });
          totalInserted++;
        } catch {
          // duplicate or DB error, skip
        }
      }
    } catch {
      // feed fetch failed, continue with next
    }
  }

  return NextResponse.json({ ok: true, inserted: totalInserted });
}
