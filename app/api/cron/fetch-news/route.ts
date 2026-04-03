import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { XMLParser } from "fast-xml-parser";
import OpenAI from "openai";

import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

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

type DigestTriggerResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown }
  | { ok: false; error: string };

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

async function triggerDigest(origin: string, authHeader: string | null): Promise<DigestTriggerResult> {
  try {
    const headers: HeadersInit = {};
    if (authHeader) headers.authorization = authHeader;

    const response = await fetch(`${origin}/api/cron/digest`, {
      headers,
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

  const enriched = await enrichNewItems();

  const digest = await triggerDigest(req.nextUrl.origin, authHeader);

  return NextResponse.json({
    ok: true,
    inserted: totalInserted,
    enriched,
    digest,
  });
}

const ENRICH_BATCH_SIZE = 10;

async function enrichNewItems(): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return 0;

  const items = await prisma.newsItem.findMany({
    where: { enrichedSummary: null },
    orderBy: { publishedAt: "desc" },
    take: ENRICH_BATCH_SIZE,
  });

  if (items.length === 0) return 0;

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL_ENRICH || "gpt-5.4";
  let count = 0;

  for (const item of items) {
    try {
      const prompt = [
        "You are a news research assistant. Given the headline and short blurb of a tech/AI news article, write a detailed English summary of approximately 200-250 words.",
        "Cover: what happened, who is involved, why it matters, technical details if available, and potential impact.",
        "Be factual and informative. Do not editorialize. Write in clear prose paragraphs, not bullet points.",
        "",
        `Headline: ${item.title}`,
        `Source: ${item.sourceName}`,
        `URL: ${item.sourceUrl}`,
        item.summary ? `Blurb: ${item.summary}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 600,
      });

      const content = completion.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 50) {
        await prisma.newsItem.update({
          where: { id: item.id },
          data: { enrichedSummary: content },
        });
        count++;
      }
    } catch {
      // skip failed items, will retry next run
    }
  }

  return count;
}
