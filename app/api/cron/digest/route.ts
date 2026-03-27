import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  buildDigestHashtags,
  buildFeedbackWindowSummary,
  composeDigestSystemPrompt,
  NEWS_DIGEST_BASE_PROMPT_VERSION,
  parseJsonObjectFromText,
} from "@/app/lib/news-digest";
import { prisma } from "@/app/lib/prisma";

const digestResponseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .refine((value) => Array.from(value).length < 20, "Title must be under 20 characters"),
  hashtags: z.array(z.string().trim().min(1).max(80)).min(3).max(12),
  script: z.string().trim().min(1).max(4000),
});

function todayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
      select: { pickedIds: true },
    });
    const usedIds = new Set(recentDigests.flatMap((d) => d.pickedIds));

    const newsItems = (await prisma.newsItem.findMany({
      where: { publishedAt: { gte: threeDaysBefore } },
      orderBy: { publishedAt: "desc" },
      take: 80,
    })).filter((n) => !usedIds.has(n.id));

    if (newsItems.length === 0) {
      return NextResponse.json({ ok: false, reason: "no news in window" });
    }

    const newsList = newsItems
      .map(
        (n, i) =>
          `${i + 1}. [${n.sourceName}] ${n.title}${n.summary ? "\n   " + n.summary.slice(0, 200) : ""}`
      )
      .join("\n");

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

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: newsList },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) {
      return NextResponse.json({ ok: false, reason: "LLM returned empty" });
    }

    const parsed = digestResponseSchema.safeParse(parseJsonObjectFromText(content));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, reason: "LLM returned invalid digest payload" }, { status: 502 });
    }

    const digestTitle = parsed.data.title.trim();
    const digestHashtags = buildDigestHashtags(parsed.data.hashtags);
    const script = parsed.data.script.trim();

    const digest = await prisma.newsDigest.upsert({
      where: { date: targetDate },
      create: {
        date: targetDate,
        title: digestTitle,
        hashtags: digestHashtags,
        script,
        pickedIds: newsItems.slice(0, 5).map((n) => n.id),
      },
      update: {
        title: digestTitle,
        hashtags: digestHashtags,
        script,
        pickedIds: newsItems.slice(0, 5).map((n) => n.id),
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
