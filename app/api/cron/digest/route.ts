import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  buildDigestHashtags,
  buildDigestScript,
  buildFeedbackWindowSummary,
  compressDigestTitle,
  composeDigestSystemPrompt,
  DIGEST_OBSERVATION_CHAR_LIMIT,
  DIGEST_SEGMENT_CHAR_LIMIT,
  DIGEST_TARGET_NEWS_COUNT,
  NEWS_DIGEST_BASE_PROMPT_VERSION,
  parseJsonObjectFromText,
} from "@/app/lib/news-digest";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

const digestResponseSchema = z.object({
  title: z.string().trim().min(1).max(140),
  hashtags: z.array(z.string().trim().min(1).max(80)).min(3).max(12),
  newsItems: z
    .array(
      z.object({
        keyword: z.string().trim().min(1).max(80),
        segment: z.string().trim().min(1).max(500),
      })
    )
    .min(1)
    .max(DIGEST_TARGET_NEWS_COUNT),
  observation: z.string().trim().min(1).max(200),
});

function charCount(value: string): number {
  return Array.from(value.trim()).length;
}

function sentenceCount(value: string): number {
  return value
    .split(/[。！？!?]/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function todayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    // Optional ?date=YYYY-MM-DD to regenerate a past digest
    const dateParam = req.nextUrl.searchParams.get("date");
    const targetDate = dateParam
      ? new Date(dateParam + "T00:00:00.000Z")
      : todayDate();

    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date param" }, { status: 400 });
    }

    const threeDaysBefore = new Date(targetDate.getTime() - 3 * 24 * 60 * 60 * 1000);

    const recentDigests = await prisma.newsDigest.findMany({
      where: { date: { gte: new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      select: { date: true, pickedIds: true },
    });
    const usedIds = new Set(
      recentDigests
        .filter((digest) => !sameUtcDay(digest.date, targetDate))
        .flatMap((digest) => digest.pickedIds)
    );

    const newsItems = (await prisma.newsItem.findMany({
      where: { publishedAt: { gte: threeDaysBefore } },
      orderBy: { publishedAt: "desc" },
      take: 80,
    })).filter((n) => !usedIds.has(n.id));

    if (newsItems.length === 0) {
      return NextResponse.json({ ok: false, reason: "no news in window" });
    }

    const selectedNewsItems = newsItems.slice(0, Math.min(DIGEST_TARGET_NEWS_COUNT, newsItems.length));
    const newsList = selectedNewsItems
      .map(
        (n, i) =>
          `${i + 1}. [${n.sourceName}] ${n.title}${n.summary ? "\n   " + n.summary.slice(0, 200) : ""}`
      )
      .join("\n");
    const userPrompt = [
      `今天必须严格写 ${selectedNewsItems.length} 条新闻。`,
      `你必须完整覆盖下面这 ${selectedNewsItems.length} 条，不能省略，不能把两条并成一条。`,
      `返回 JSON 时，newsItems 数组长度必须严格等于 ${selectedNewsItems.length}，并且顺序必须和输入新闻顺序一致。`,
      "",
      newsList,
    ].join("\n");

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const [activeRuleSet, recentFeedbacks] = await Promise.all([
      prisma.newsDigestStyleRuleSet.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { approvedAt: "desc" },
      }),
      prisma.newsDigestFeedback.findMany({
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: {
          digest: {
            select: {
              date: true,
              script: true,
            },
          },
        },
      }),
    ]);

    const feedbackSummary = buildFeedbackWindowSummary(
      recentFeedbacks.map((item) => ({
        scoreOverall: item.scoreOverall,
        scoreHumor: item.scoreHumor,
        scoreHumanity: item.scoreHumanity,
        scoreClarity: item.scoreClarity,
        scoreInsight: item.scoreInsight,
        bestLine: item.bestLine,
        worstIssue: item.worstIssue,
        rewriteHint: item.rewriteHint,
        comment: item.comment,
        digest: item.digest,
      }))
    );

    const systemPrompt = composeDigestSystemPrompt({
      activeRuleSet: activeRuleSet
        ? {
            version: activeRuleSet.version,
            title: activeRuleSet.title,
            sourceSummary: activeRuleSet.sourceSummary,
            moreToLeanInto: activeRuleSet.moreToLeanInto,
            lessToAvoid: activeRuleSet.lessToAvoid,
            guardrails: activeRuleSet.guardrails,
            exampleWins: activeRuleSet.exampleWins,
            exampleMisses: activeRuleSet.exampleMisses,
          }
        : null,
      feedbackSummary,
    });

    let digestTitle = "";
    let digestHashtags: string[] = [];
    let script = "";
    let lastFailure = "unknown";
    let lastContent = "";

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = completion.choices?.[0]?.message?.content ?? "";
      lastContent = content;
      if (!content.trim()) {
        lastFailure = "LLM returned empty";
        continue;
      }

      let rawPayload: unknown;
      try {
        rawPayload = parseJsonObjectFromText(content);
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "Model did not return parsable JSON";
        continue;
      }

      const parsed = digestResponseSchema.safeParse(rawPayload);
      if (!parsed.success) {
        lastFailure = parsed.error.issues.map((issue) => issue.message).join("; ");
        continue;
      }

      if (parsed.data.newsItems.length !== selectedNewsItems.length) {
        lastFailure = `Expected ${selectedNewsItems.length} newsItems, got ${parsed.data.newsItems.length}`;
        continue;
      }

      const overlongSegment = parsed.data.newsItems.find((item) => {
        const segment = item.segment.trim();
        return charCount(segment) > DIGEST_SEGMENT_CHAR_LIMIT || sentenceCount(segment) > 5;
      });
      if (overlongSegment) {
        lastFailure = `Segment too long or too dense: ${overlongSegment.keyword}`;
        continue;
      }

      if (charCount(parsed.data.observation) > DIGEST_OBSERVATION_CHAR_LIMIT) {
        lastFailure = "Observation too long";
        continue;
      }

      if (sentenceCount(parsed.data.observation) > 2) {
        lastFailure = "Observation must be one or two short sentences";
        continue;
      }

      const compressedTitle = compressDigestTitle(parsed.data.title);
      if (!compressedTitle || Array.from(compressedTitle).length >= 20) {
        lastFailure = "Title remained too long after compression";
        continue;
      }

      digestTitle = compressedTitle;
      digestHashtags = buildDigestHashtags(parsed.data.hashtags);
      script = buildDigestScript(
        parsed.data.newsItems.map((item) => item.segment),
        parsed.data.observation
      );
      break;
    }

    if (!digestTitle || !script) {
      console.error("digest cron invalid payload:", {
        targetDate: targetDate.toISOString(),
        lastFailure,
        lastContent: lastContent.slice(0, 1200),
      });
      return NextResponse.json({ ok: false, reason: "LLM returned invalid digest payload" }, { status: 502 });
    }

    const digest = await prisma.newsDigest.upsert({
      where: { date: targetDate },
      create: {
        date: targetDate,
        title: digestTitle,
        hashtags: digestHashtags,
        script,
        pickedIds: selectedNewsItems.map((n) => n.id),
      },
      update: {
        title: digestTitle,
        hashtags: digestHashtags,
        script,
        pickedIds: selectedNewsItems.map((n) => n.id),
      },
    });

    await prisma.newsDigestGenerationMeta.upsert({
      where: { digestId: digest.id },
      create: {
        digestId: digest.id,
        model,
        basePromptVersion: NEWS_DIGEST_BASE_PROMPT_VERSION,
        ruleSetId: activeRuleSet?.id ?? null,
        ruleSetVersion: activeRuleSet?.version ?? null,
        feedbackWindowSummary: feedbackSummary,
      },
      update: {
        model,
        basePromptVersion: NEWS_DIGEST_BASE_PROMPT_VERSION,
        ruleSetId: activeRuleSet?.id ?? null,
        ruleSetVersion: activeRuleSet?.version ?? null,
        feedbackWindowSummary: feedbackSummary,
      },
    });

    return NextResponse.json({
      ok: true,
      date: targetDate.toISOString(),
      length: script.length,
      title: digestTitle,
      hashtags: digestHashtags,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("digest cron error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
