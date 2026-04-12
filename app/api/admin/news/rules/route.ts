import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import {
  NEWS_DIGEST_BASE_PROMPT,
  formatRuleSetForPrompt,
  parseJsonObjectFromText,
} from "@/app/lib/news-digest";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const requestSchema = z.object({
  lookback: z.number().int().min(3).max(50).optional(),
});

const responseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sourceSummary: z.string().trim().min(1).max(2000),
  moreToLeanInto: z.array(z.string().trim().min(1).max(240)).min(2).max(6),
  lessToAvoid: z.array(z.string().trim().min(1).max(240)).min(2).max(6),
  guardrails: z.array(z.string().trim().min(1).max(240)).min(2).max(6),
  exampleWins: z.array(z.string().trim().min(1).max(240)).max(6),
  exampleMisses: z.array(z.string().trim().min(1).max(240)).max(6),
});

function excerpt(value: string, limit = 220): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit).trim()}...`;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const lookback = parsedBody.data.lookback ?? 20;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const [feedbacks, activeRuleSet, latestRuleSet] = await Promise.all([
    prisma.newsDigestFeedback.findMany({
      orderBy: { updatedAt: "desc" },
      take: lookback,
      include: {
        digest: {
          select: {
            id: true,
            date: true,
            script: true,
            generationMeta: true,
          },
        },
      },
    }),
    prisma.newsDigestStyleRuleSet.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { approvedAt: "desc" },
    }),
    prisma.newsDigestStyleRuleSet.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    }),
  ]);

  if (feedbacks.length < 3) {
    return NextResponse.json({ error: "Need at least 3 feedback entries" }, { status: 400 });
  }

  const feedbackBlock = feedbacks
    .map(
      (item, index) =>
        [
          `${index + 1}. 日期：${item.digest.date.toISOString().slice(0, 10)}`,
          `总分：${item.scoreOverall}/20；幽默 ${item.scoreHumor}/5；人味 ${item.scoreHumanity}/5；清晰 ${item.scoreClarity}/5；观察 ${item.scoreInsight}/5`,
          `最像献哥：${item.bestLine}`,
          `最出戏：${item.worstIssue}`,
          item.rewriteHint ? `下次建议：${item.rewriteHint}` : "",
          item.comment ? `备注：${item.comment}` : "",
          `稿件摘录：${excerpt(item.digest.script)}`,
          item.digest.generationMeta?.ruleSetVersion
            ? `生成时使用规则版本：v${item.digest.generationMeta.ruleSetVersion}`
            : "生成时使用规则版本：base only",
        ]
          .filter(Boolean)
          .join("\n")
    )
    .join("\n\n");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    max_completion_tokens: 1400,
    messages: [
      {
        role: "system",
        content: [
          "你是新闻口播风格调参助手。你要根据人工评分，归纳出下一版应该如何写得更幽默、更有人味，同时保持技术准确。",
          "你的输出必须是一个 JSON 对象，不要输出 markdown 代码块。",
          "请把建议写成可执行的风格规则，而不是抽象评价。",
          "不要建议编造事实，不要建议为了搞笑而牺牲信息准确性。",
          "字段要求：title, sourceSummary, moreToLeanInto, lessToAvoid, guardrails, exampleWins, exampleMisses。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "这是当前稳定的 base prompt：",
          NEWS_DIGEST_BASE_PROMPT,
          "",
          activeRuleSet
            ? `当前激活规则：\n${formatRuleSetForPrompt({
                version: activeRuleSet.version,
                title: activeRuleSet.title,
                sourceSummary: activeRuleSet.sourceSummary,
                moreToLeanInto: activeRuleSet.moreToLeanInto,
                lessToAvoid: activeRuleSet.lessToAvoid,
                guardrails: activeRuleSet.guardrails,
                exampleWins: activeRuleSet.exampleWins,
                exampleMisses: activeRuleSet.exampleMisses,
              })}`
            : "当前还没有激活规则。",
          "",
          `以下是最近 ${feedbacks.length} 条人工反馈，请你归纳下一版风格规则：`,
          feedbackBlock,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  const parsed = responseSchema.safeParse(parseJsonObjectFromText(content));
  if (!parsed.success) {
    return NextResponse.json({ error: "Model returned invalid rule draft" }, { status: 502 });
  }

  const nextVersion = (latestRuleSet?.version ?? 0) + 1;
  const ruleSet = await prisma.newsDigestStyleRuleSet.create({
    data: {
      version: nextVersion,
      status: "DRAFT",
      title: parsed.data.title,
      sourceSummary: parsed.data.sourceSummary,
      sourceFeedbackCount: feedbacks.length,
      model,
      moreToLeanInto: parsed.data.moreToLeanInto,
      lessToAvoid: parsed.data.lessToAvoid,
      guardrails: parsed.data.guardrails,
      exampleWins: parsed.data.exampleWins,
      exampleMisses: parsed.data.exampleMisses,
    },
  });

  return NextResponse.json({
    ruleSet: {
      id: ruleSet.id,
      version: ruleSet.version,
      status: ruleSet.status,
      title: ruleSet.title,
      sourceSummary: ruleSet.sourceSummary,
      sourceFeedbackCount: ruleSet.sourceFeedbackCount,
      model: ruleSet.model,
      moreToLeanInto: ruleSet.moreToLeanInto,
      lessToAvoid: ruleSet.lessToAvoid,
      guardrails: ruleSet.guardrails,
      exampleWins: ruleSet.exampleWins,
      exampleMisses: ruleSet.exampleMisses,
      createdAt: ruleSet.createdAt.toISOString(),
      updatedAt: ruleSet.updatedAt.toISOString(),
      approvedAt: ruleSet.approvedAt?.toISOString() ?? null,
      approvedBy: ruleSet.approvedBy,
    },
  });
}
