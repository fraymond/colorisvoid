import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

function serializeRuleSet(ruleSet: {
  id: string;
  version: number;
  status: string;
  title: string;
  sourceSummary: string;
  sourceFeedbackCount: number;
  model: string | null;
  moreToLeanInto: string[];
  lessToAvoid: string[];
  guardrails: string[];
  exampleWins: string[];
  exampleMisses: string[];
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
}) {
  return {
    ...ruleSet,
    createdAt: ruleSet.createdAt.toISOString(),
    updatedAt: ruleSet.updatedAt.toISOString(),
    approvedAt: ruleSet.approvedAt?.toISOString() ?? null,
  };
}

function averageScore(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [digests, ruleSets, activeRuleSet] = await Promise.all([
    prisma.newsDigest.findMany({
      orderBy: { date: "desc" },
      take: 14,
      include: {
        feedbacks: {
          orderBy: { updatedAt: "desc" },
        },
        generationMeta: true,
      },
    }),
    prisma.newsDigestStyleRuleSet.findMany({
      orderBy: [{ status: "asc" }, { version: "desc" }],
      take: 12,
    }),
    prisma.newsDigestStyleRuleSet.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { approvedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    digests: digests.map((digest) => ({
      id: digest.id,
      date: digest.date.toISOString(),
      title: digest.title,
      hashtags: digest.hashtags,
      script: digest.script,
      pickedIds: digest.pickedIds,
      createdAt: digest.createdAt.toISOString(),
      feedbackAverage: {
        overall: averageScore(digest.feedbacks.map((item) => item.scoreOverall)),
        humor: averageScore(digest.feedbacks.map((item) => item.scoreHumor)),
        humanity: averageScore(digest.feedbacks.map((item) => item.scoreHumanity)),
        clarity: averageScore(digest.feedbacks.map((item) => item.scoreClarity)),
        insight: averageScore(digest.feedbacks.map((item) => item.scoreInsight)),
      },
      feedbacks: digest.feedbacks.map((item) => ({
        id: item.id,
        createdBy: item.createdBy,
        scoreOverall: item.scoreOverall,
        scoreHumor: item.scoreHumor,
        scoreHumanity: item.scoreHumanity,
        scoreClarity: item.scoreClarity,
        scoreInsight: item.scoreInsight,
        bestLine: item.bestLine,
        worstIssue: item.worstIssue,
        rewriteHint: item.rewriteHint,
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      generationMeta: digest.generationMeta
        ? {
            id: digest.generationMeta.id,
            model: digest.generationMeta.model,
            basePromptVersion: digest.generationMeta.basePromptVersion,
            ruleSetId: digest.generationMeta.ruleSetId,
            ruleSetVersion: digest.generationMeta.ruleSetVersion,
            feedbackWindowSummary: digest.generationMeta.feedbackWindowSummary,
            createdAt: digest.generationMeta.createdAt.toISOString(),
          }
        : null,
    })),
    ruleSets: ruleSets.map(serializeRuleSet),
    activeRuleSet: activeRuleSet ? serializeRuleSet(activeRuleSet) : null,
    viewer: {
      userId: admin.userId,
    },
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const secret = process.env.CRON_SECRET ?? "";
  const headers: Record<string, string> = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const fetchRes = await fetch(`${origin}/api/cron/fetch-news`, { headers });
  const fetchData = await fetchRes.json();
  const digestData =
    fetchData &&
    typeof fetchData === "object" &&
    "digest" in fetchData
      ? fetchData.digest
      : null;

  return NextResponse.json({ fetch: fetchData, digest: digestData });
}
