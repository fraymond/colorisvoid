import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  buildDigestHashtags,
  compressDigestTitle,
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
  newsItemIds: z.array(z.string()).min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  generateVersion: z.boolean().optional(),
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

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { digestId, newsItemIds, messages, generateVersion } = parsed.data;

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

  const newsList = orderedNews
    .map(
      (n, i) =>
        `${i + 1}. [${n.sourceName}] ${n.title}${n.enrichedSummary ? "\n   " + n.enrichedSummary.slice(0, 500) : n.summary ? "\n   " + n.summary.slice(0, 200) : ""}`
    )
    .join("\n");

  const baseSystemPrompt = composeLayeredSystemPrompt({
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
    rewriteNote: null,
  });

  const currentDigestContext = [
    `## Current digest for ${digest.date.toISOString().slice(0, 10)}`,
    digest.title ? `Title: ${digest.title}` : "",
    `Script:\n${digest.script}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = generateVersion
    ? [
        baseSystemPrompt,
        "",
        "The user has been giving you feedback in a conversation. Now they want a final rewrite.",
        "You MUST output a valid JSON object in the standard digest format (title, copywriting, coverTitle, coverSubtitle, hashtags, newsItems).",
        "Apply all the feedback from the conversation to produce the best possible version.",
        "",
        `## Selected news (${orderedNews.length} items)`,
        newsList,
        "",
        currentDigestContext,
      ].join("\n")
    : [
        "You are an editorial advisor helping refine a daily AI news digest (献哥AI报道).",
        "You have deep knowledge of the writing style and rules from the digest system.",
        "Respond conversationally in the same language the user writes in.",
        "Give specific, actionable advice. Quote and suggest rewrites for specific lines when relevant.",
        "Be concise — this is a working chat, not an essay.",
        "",
        baseSystemPrompt,
        "",
        `## Selected news (${orderedNews.length} items)`,
        newsList,
        "",
        currentDigestContext,
      ].join("\n");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (generateVersion) {
    chatMessages.push({
      role: "user",
      content: [
        `Based on our entire conversation, generate a final rewrite.`,
        `严格写 ${orderedNews.length} 条新闻。newsItems 数组长度必须严格等于 ${orderedNews.length}。`,
        `Return ONLY the JSON object.`,
      ].join("\n"),
    });
  }

  const completion = await client.chat.completions.create({
    model,
    messages: chatMessages,
    temperature: generateVersion ? 0.7 : 0.5,
    max_completion_tokens: generateVersion ? 2000 : 1000,
  });

  const content = completion.choices?.[0]?.message?.content?.trim() ?? "";

  if (!generateVersion) {
    return NextResponse.json({ reply: content });
  }

  let rawPayload: unknown;
  try {
    rawPayload = parseJsonObjectFromText(content);
  } catch {
    return NextResponse.json({
      reply: content,
      versionError: "LLM response was not valid JSON. Try asking it to generate again.",
    });
  }

  const result = digestResponseSchema.safeParse(rawPayload);
  if (!result.success) {
    return NextResponse.json({
      reply: content,
      versionError: "JSON structure invalid: " + result.error.issues.map((i) => i.message).join("; "),
    });
  }

  const validStories: StoryShape[] = result.data.stories.map((s) => ({
    ...s,
    title: compressDigestTitle(s.title) || s.title,
    hashtags: buildDigestHashtags(s.hashtags),
  }));

  const first = validStories[0];
  const combinedScript = validStories.map((s) => s.segment.trim()).join("\n\n");

  const maxVersion = await prisma.newsDigestVersion.findFirst({
    where: { digestId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (maxVersion?.version ?? 0) + 1;

  const conversationSummary = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" → ");

  const skillSnapshot = JSON.stringify({
    basePromptVersion: NEWS_DIGEST_BASE_PROMPT_VERSION,
    userProfile: profile ? { id: profile.id } : null,
    topicSkill: topicSkill ? { id: topicSkill.id } : null,
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
      rewriteNote: conversationSummary.slice(0, 500) || null,
      model,
      skillSnapshot,
    },
  });

  return NextResponse.json({
    reply: content,
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
