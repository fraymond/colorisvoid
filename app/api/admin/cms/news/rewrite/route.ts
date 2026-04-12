import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  buildDigestHashtags,
  compressDigestTitle,
  DIGEST_SEGMENT_CHAR_LIMIT,
  DIGEST_TARGET_NEWS_COUNT,
  getDigestBasePrompt,
  NEWS_DIGEST_BASE_PROMPT_VERSION,
  parseJsonObjectFromText,
} from "@/app/lib/news-digest";
import type { StoryShape } from "@/app/lib/news-digest";
import { composeLayeredSystemPrompt } from "@/app/lib/prompt-composer";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const requestSchema = z.object({
  digestId: z.string().min(1),
  newsItemIds: z.array(z.string()).min(1).max(DIGEST_TARGET_NEWS_COUNT),
  rewriteNote: z.string().optional(),
});

const storySchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(140),
  copywriting: z.string().trim().min(1).max(200),
  coverTitle: z.string().trim().min(1).max(30),
  coverSubtitle: z.string().trim().min(1).max(60),
  hashtags: z.array(z.string().trim().min(1).max(80)).min(3).max(12),
  segment: z.string().trim().min(1).max(800),
});

const digestResponseSchema = z.object({
  stories: z.array(storySchema).length(DIGEST_TARGET_NEWS_COUNT),
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
    `今天你要从下面的新闻素材里，写出 ${orderedNews.length} 个独立的故事。`,
    `每个故事必须包含：钩子 → 展开 → 高潮 → 有趣的收尾。`,
    `返回 JSON 时，newsItems 数组长度必须严格等于 ${orderedNews.length}。`,
    "",
    newsList,
  ].join("\n");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  let validStories: StoryShape[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 4000,
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

    const overlongStory = result.data.stories.find((s) => {
      const seg = s.segment.trim();
      return charCount(seg) > DIGEST_SEGMENT_CHAR_LIMIT || sentenceCount(seg) > 15;
    });
    if (overlongStory) continue;

    const badTitle = result.data.stories.find((s) => {
      const compressed = compressDigestTitle(s.title);
      return !compressed || Array.from(compressed).length >= 20;
    });
    if (badTitle) continue;

    validStories = result.data.stories.map((s) => ({
      ...s,
      title: compressDigestTitle(s.title),
      hashtags: buildDigestHashtags(s.hashtags),
    }));
    break;
  }

  if (validStories.length === 0) {
    return NextResponse.json({ error: "LLM failed to produce valid stories" }, { status: 502 });
  }

  const first = validStories[0];
  const combinedScript = validStories.map((s) => s.segment.trim()).join("\n\n");

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
      title: first.title,
      hashtags: first.hashtags,
      script: combinedScript,
      pickedIds: newsItemIds,
      createdBy: admin.userId,
      rewriteNote: rewriteNote || null,
      model,
      skillSnapshot,
    },
  });

  return NextResponse.json({
    ok: true,
    stories: validStories,
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
