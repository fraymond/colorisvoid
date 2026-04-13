import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";
import type { StoryShape } from "@/app/lib/news-digest";
import {
  getDigestBasePrompt,
  composeDigestSystemPrompt,
  parseJsonObjectFromText,
  buildDigestHashtags,
  compressDigestTitle,
} from "@/app/lib/news-digest";

const storySchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  copywriting: z.string().trim().max(300).default(""),
  coverTitle: z.string().trim().max(30).default(""),
  coverSubtitle: z.string().trim().max(60).default(""),
  hashtags: z.array(z.string().trim().max(80)).default([]),
  segment: z.string().trim().min(1),
});

const putSchema = z.object({
  digestId: z.string().min(1),
  stories: z.array(storySchema).min(0),
});

const postAddSchema = z.object({
  digestId: z.string().min(1),
  newsItemId: z.string().min(1),
});

const deleteSchema = z.object({
  digestId: z.string().min(1),
  storyIndex: z.number().int().min(0),
});

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam + "T00:00:00Z") : null;

  const digests = await prisma.newsDigest.findMany({
    orderBy: { date: "desc" },
    take: 30,
    select: {
      id: true,
      date: true,
      storiesJson: true,
      pickedIds: true,
    },
  });

  const digest = targetDate
    ? digests.find((d) => d.date.toISOString().slice(0, 10) === targetDate.toISOString().slice(0, 10))
    : digests[0];

  if (!digest) {
    return NextResponse.json({ digest: null, availableNews: [], dates: [] });
  }

  const stories = (digest.storiesJson as StoryShape[] | null) ?? [];

  const twoDaysAgo = new Date(digest.date.getTime() - 2 * 24 * 60 * 60 * 1000);
  const newsItems = await prisma.newsItem.findMany({
    where: { publishedAt: { gte: twoDaysAgo } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      sourceName: true,
      summary: true,
      enrichedSummary: true,
      publishedAt: true,
    },
  });

  const dates = digests.map((d) => d.date.toISOString().slice(0, 10));

  return NextResponse.json({
    digest: {
      id: digest.id,
      date: digest.date.toISOString().slice(0, 10),
      stories,
      pickedIds: digest.pickedIds,
    },
    availableNews: newsItems,
    dates,
  });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const { digestId, stories } = parsed.data;

  const digest = await prisma.newsDigest.findUnique({ where: { id: digestId }, select: { id: true } });
  if (!digest) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const combinedScript = stories.map((s) => s.segment.trim()).join("\n\n");
  const first = stories[0];

  await prisma.newsDigest.update({
    where: { id: digestId },
    data: {
      storiesJson: stories as any,
      script: combinedScript,
      title: first?.title ?? null,
      copywriting: first?.copywriting ?? null,
      coverTitle: first?.coverTitle ?? null,
      coverSubtitle: first?.coverSubtitle ?? null,
      hashtags: first?.hashtags ?? [],
    },
  });

  return NextResponse.json({ ok: true });
}

const singleStorySchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(140),
  copywriting: z.string().trim().min(1).max(300),
  coverTitle: z.string().trim().min(1).max(30),
  coverSubtitle: z.string().trim().min(1).max(60),
  hashtags: z.array(z.string().trim().min(1).max(80)).min(3).max(12),
  segment: z.string().trim().min(1).max(800),
});

async function generateStoryFromNews(newsTitle: string, newsSummary: string): Promise<StoryShape | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const basePrompt = await getDigestBasePrompt();
  const systemPrompt = composeDigestSystemPrompt({
    basePrompt,
    activeRuleSet: null,
    feedbackSummary: null,
  });

  const userPrompt = [
    "请根据下面这条新闻素材，写出 1 个独立的科普小故事。",
    "必须包含：钩子 → 展开 → 高潮 → 有趣的收尾。",
    "返回 JSON：{ \"story\": { \"keyword\", \"title\", \"copywriting\", \"coverTitle\", \"coverSubtitle\", \"hashtags\", \"segment\" } }",
    "只返回 JSON，不要加任何其他文字。",
    "",
    `新闻标题：${newsTitle}`,
    newsSummary ? `新闻摘要：${newsSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_completion_tokens: 2000,
      });

      const content = completion.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) continue;

      const raw = parseJsonObjectFromText(content) as any;
      const storyData = raw?.story ?? raw?.stories?.[0] ?? raw;
      const parsed = singleStorySchema.safeParse(storyData);
      if (!parsed.success) continue;

      return {
        ...parsed.data,
        title: compressDigestTitle(parsed.data.title),
        hashtags: buildDigestHashtags(parsed.data.hashtags),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = postAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const { digestId, newsItemId } = parsed.data;

  const [digest, newsItem] = await Promise.all([
    prisma.newsDigest.findUnique({ where: { id: digestId }, select: { id: true, storiesJson: true } }),
    prisma.newsItem.findUnique({
      where: { id: newsItemId },
      select: { title: true, summary: true, enrichedSummary: true, sourceName: true },
    }),
  ]);

  if (!digest) return NextResponse.json({ error: "digest_not_found" }, { status: 404 });
  if (!newsItem) return NextResponse.json({ error: "news_not_found" }, { status: 404 });

  const summary = newsItem.enrichedSummary || newsItem.summary || "";
  const generated = await generateStoryFromNews(newsItem.title, summary);

  if (!generated) {
    return NextResponse.json({ error: "LLM failed to generate story" }, { status: 502 });
  }

  const stories = (digest.storiesJson as StoryShape[] | null) ?? [];
  stories.push(generated);

  await prisma.newsDigest.update({
    where: { id: digestId },
    data: { storiesJson: stories as any },
  });

  return NextResponse.json({ ok: true, story: generated, index: stories.length - 1 });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const { digestId, storyIndex } = parsed.data;

  const digest = await prisma.newsDigest.findUnique({
    where: { id: digestId },
    select: { id: true, storiesJson: true },
  });
  if (!digest) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const stories = (digest.storiesJson as StoryShape[] | null) ?? [];
  if (storyIndex >= stories.length) {
    return NextResponse.json({ error: "index_out_of_range" }, { status: 400 });
  }

  stories.splice(storyIndex, 1);

  const combinedScript = stories.map((s) => s.segment.trim()).join("\n\n");
  const first = stories[0];

  await prisma.newsDigest.update({
    where: { id: digestId },
    data: {
      storiesJson: stories.length > 0 ? (stories as any) : null,
      script: combinedScript,
      title: first?.title ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
