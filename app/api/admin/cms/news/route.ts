import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

function averageScore(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const dateParam = url.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam + "T00:00:00.000Z") : null;

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [newsItems, digests, profile, topicSkill] = await Promise.all([
    prisma.newsItem.findMany({
      where: targetDate
        ? {
            publishedAt: {
              gte: new Date(targetDate.getTime() - 3 * 24 * 60 * 60 * 1000),
              lte: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
            },
          }
        : { publishedAt: { gte: threeDaysAgo } },
      orderBy: { publishedAt: "desc" },
      take: 80,
    }),
    prisma.newsDigest.findMany({
      orderBy: { date: "desc" },
      take: 14,
      include: {
        feedbacks: { orderBy: { updatedAt: "desc" } },
        generationMeta: true,
        versions: { orderBy: { version: "desc" } },
      },
    }),
    prisma.userWritingProfile.findUnique({ where: { userId: admin.userId } }),
    prisma.userTopicSkill.findFirst({
      where: {
        userId: admin.userId,
        topic: { slug: "ai-news" },
      },
    }),
  ]);

  return NextResponse.json({
    newsItems: newsItems.map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      enrichedSummary: n.enrichedSummary,
      sourceUrl: n.sourceUrl,
      sourceName: n.sourceName,
      publishedAt: n.publishedAt.toISOString(),
      fetchedAt: n.fetchedAt.toISOString(),
    })),
    digests: digests.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      title: d.title,
      hashtags: d.hashtags,
      script: d.script,
      pickedIds: d.pickedIds,
      createdAt: d.createdAt.toISOString(),
      feedbackAverage: {
        overall: averageScore(d.feedbacks.map((f) => f.scoreOverall)),
        humor: averageScore(d.feedbacks.map((f) => f.scoreHumor)),
        humanity: averageScore(d.feedbacks.map((f) => f.scoreHumanity)),
        clarity: averageScore(d.feedbacks.map((f) => f.scoreClarity)),
        insight: averageScore(d.feedbacks.map((f) => f.scoreInsight)),
      },
      feedbacks: d.feedbacks.map((f) => ({
        id: f.id,
        createdBy: f.createdBy,
        scoreOverall: f.scoreOverall,
        scoreHumor: f.scoreHumor,
        scoreHumanity: f.scoreHumanity,
        scoreClarity: f.scoreClarity,
        scoreInsight: f.scoreInsight,
        bestLine: f.bestLine,
        worstIssue: f.worstIssue,
        rewriteHint: f.rewriteHint,
        comment: f.comment,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
      generationMeta: d.generationMeta
        ? {
            id: d.generationMeta.id,
            model: d.generationMeta.model,
            basePromptVersion: d.generationMeta.basePromptVersion,
            ruleSetVersion: d.generationMeta.ruleSetVersion,
          }
        : null,
      versions: d.versions.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        script: v.script,
        status: v.status,
        createdBy: v.createdBy,
        rewriteNote: v.rewriteNote,
        model: v.model,
        createdAt: v.createdAt.toISOString(),
      })),
    })),
    viewer: {
      userId: admin.userId,
      hasProfile: !!profile,
      hasTopicSkill: !!topicSkill,
    },
  });
}
