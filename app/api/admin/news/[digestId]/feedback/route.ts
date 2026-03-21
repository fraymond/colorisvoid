import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { computeOverallScore } from "@/app/lib/news-digest";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const feedbackSchema = z.object({
  scoreHumor: z.number().int().min(0).max(5),
  scoreHumanity: z.number().int().min(0).max(5),
  scoreClarity: z.number().int().min(0).max(5),
  scoreInsight: z.number().int().min(0).max(5),
  bestLine: z.string().trim().min(1).max(500),
  worstIssue: z.string().trim().min(1).max(500),
  rewriteHint: z.string().trim().max(500).optional().nullable(),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ digestId: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { digestId } = await context.params;
  const digest = await prisma.newsDigest.findUnique({
    where: { id: digestId },
    select: { id: true },
  });

  if (!digest) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  const payload = parsed.data;
  const scoreOverall = computeOverallScore({
    humor: payload.scoreHumor,
    humanity: payload.scoreHumanity,
    clarity: payload.scoreClarity,
    insight: payload.scoreInsight,
  });

  const feedback = await prisma.newsDigestFeedback.upsert({
    where: {
      digestId_createdBy: {
        digestId,
        createdBy: admin.userId,
      },
    },
    create: {
      digestId,
      createdBy: admin.userId,
      scoreOverall,
      scoreHumor: payload.scoreHumor,
      scoreHumanity: payload.scoreHumanity,
      scoreClarity: payload.scoreClarity,
      scoreInsight: payload.scoreInsight,
      bestLine: payload.bestLine,
      worstIssue: payload.worstIssue,
      rewriteHint: payload.rewriteHint || null,
      comment: payload.comment || null,
    },
    update: {
      scoreOverall,
      scoreHumor: payload.scoreHumor,
      scoreHumanity: payload.scoreHumanity,
      scoreClarity: payload.scoreClarity,
      scoreInsight: payload.scoreInsight,
      bestLine: payload.bestLine,
      worstIssue: payload.worstIssue,
      rewriteHint: payload.rewriteHint || null,
      comment: payload.comment || null,
    },
  });

  return NextResponse.json({
    feedback: {
      id: feedback.id,
      createdBy: feedback.createdBy,
      scoreOverall: feedback.scoreOverall,
      scoreHumor: feedback.scoreHumor,
      scoreHumanity: feedback.scoreHumanity,
      scoreClarity: feedback.scoreClarity,
      scoreInsight: feedback.scoreInsight,
      bestLine: feedback.bestLine,
      worstIssue: feedback.worstIssue,
      rewriteHint: feedback.rewriteHint,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
    },
  });
}
