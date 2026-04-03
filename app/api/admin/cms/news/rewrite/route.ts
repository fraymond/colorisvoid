import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  buildDigestHashtags,
  buildDigestScript,
  compressDigestTitle,
  DIGEST_OBSERVATION_CHAR_LIMIT,
  DIGEST_SEGMENT_CHAR_LIMIT,
  DIGEST_TARGET_NEWS_COUNT,
  getDigestBasePrompt,
  NEWS_DIGEST_BASE_PROMPT_VERSION,
  parseJsonObjectFromText,
} from "@/app/lib/news-digest";
import { composeLayeredSystemPrompt } from "@/app/lib/prompt-composer";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const requestSchema = z.object({
  digestId: z.string().min(1),
  newsItemIds: z.array(z.string()).min(1).max(DIGEST_TARGET_NEWS_COUNT),
  rewriteNote: z.string().optional(),
});

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
    .map((p) => p.trim())
    .filter(Boolean).length;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { digestId, newsItemIds, rewriteNote } = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const [digest, selectedNews, profile, topicSkill, activeRuleSet, basePrompt] = await Promise.all([
    prisma.newsDigest.findUnique({ where: { id: digestId } }),
    prisma.newsItem.findMany({ where: { id: { in: newsItemIds } } }),
    prisma.userWritingProfile.findUnique({ where: { userId: admin.userId } }),
    prisma.userTopicSkill.findFirst({
      where: { userId: admin.userId, topic: { slug: "ai-news" } },
    }),
    prisma.newsDigestStyleRuleSet.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { approvedAt: "desc" },
    }),
    getDigestBasePrompt(),
  ]);

  if (!digest) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  const orderedNews = newsItemIds
    .map((id) => selectedNews.find((n) => n.id === id))
    .filter(Boolean) as typeof selectedNews;

  const systemPrompt = composeLayeredSystemPrompt({
    basePrompt,
    userProfile: profile?.content ?? null,
    topicSkill: topicSkill?.content ?? null,
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
    feedbackSummary: null,
    rewriteNote: rewriteNote ?? null,
  });

  const newsList = orderedNews
    .map(
      (n, i) =>
        `${i + 1}. [${n.sourceName}] ${n.title}${n.summary ? "\n   " + n.summary.slice(0, 200) : ""}`
    )
    .join("\n");

  const userPrompt = [
    `今天必须严格写 ${orderedNews.length} 条新闻。`,
    `你必须完整覆盖下面这 ${orderedNews.length} 条，不能省略，不能把两条并成一条。`,
    `返回 JSON 时，newsItems 数组长度必须严格等于 ${orderedNews.length}，并且顺序必须和输入新闻顺序一致。`,
    "",
    newsList,
  ].join("\n");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  let digestTitle = "";
  let digestHashtags: string[] = [];
  let script = "";

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
    if (!content.trim()) continue;

    let rawPayload: unknown;
    try {
      rawPayload = parseJsonObjectFromText(content);
    } catch {
      continue;
    }

    const result = digestResponseSchema.safeParse(rawPayload);
    if (!result.success) continue;
    if (result.data.newsItems.length !== orderedNews.length) continue;

    const overlongSegment = result.data.newsItems.find((item) => {
      const seg = item.segment.trim();
      return charCount(seg) > DIGEST_SEGMENT_CHAR_LIMIT || sentenceCount(seg) > 5;
    });
    if (overlongSegment) continue;
    if (charCount(result.data.observation) > DIGEST_OBSERVATION_CHAR_LIMIT) continue;
    if (sentenceCount(result.data.observation) > 2) continue;

    const compressed = compressDigestTitle(result.data.title);
    if (!compressed || Array.from(compressed).length >= 20) continue;

    digestTitle = compressed;
    digestHashtags = buildDigestHashtags(result.data.hashtags);
    script = buildDigestScript(
      result.data.newsItems.map((item) => item.segment),
      result.data.observation
    );
    break;
  }

  if (!digestTitle || !script) {
    return NextResponse.json({ error: "LLM failed to produce valid digest" }, { status: 502 });
  }

  const maxVersion = await prisma.newsDigestVersion.findFirst({
    where: { digestId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (maxVersion?.version ?? 0) + 1;

  const skillSnapshot = JSON.stringify({
    basePromptVersion: NEWS_DIGEST_BASE_PROMPT_VERSION,
    userProfile: profile ? { id: profile.id, updatedAt: profile.updatedAt } : null,
    topicSkill: topicSkill ? { id: topicSkill.id, updatedAt: topicSkill.updatedAt } : null,
    ruleSetVersion: activeRuleSet?.version ?? null,
  });

  const version = await prisma.newsDigestVersion.create({
    data: {
      digestId,
      version: nextVersion,
      title: digestTitle,
      hashtags: digestHashtags,
      script,
      pickedIds: newsItemIds,
      createdBy: admin.userId,
      rewriteNote: rewriteNote || null,
      model,
      skillSnapshot,
    },
  });

  return NextResponse.json({
    ok: true,
    version: {
      id: version.id,
      version: version.version,
      title: version.title,
      script: version.script,
      status: version.status,
      createdAt: version.createdAt.toISOString(),
    },
  });
}
