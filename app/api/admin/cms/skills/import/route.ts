import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const importSchema = z.object({
  mainProfile: z
    .object({
      content: z.string().min(1).max(20000),
      format: z.string().optional(),
    })
    .nullable()
    .optional(),
  topicSkills: z
    .array(
      z.object({
        topicSlug: z.string().min(1),
        content: z.string().min(1).max(20000),
        format: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const results: string[] = [];

  if (parsed.data.mainProfile) {
    await prisma.userWritingProfile.upsert({
      where: { userId: admin.userId },
      create: {
        userId: admin.userId,
        content: parsed.data.mainProfile.content,
        format: parsed.data.mainProfile.format ?? "markdown",
      },
      update: {
        content: parsed.data.mainProfile.content,
        format: parsed.data.mainProfile.format ?? "markdown",
      },
    });
    results.push("Main profile imported");
  }

  if (parsed.data.topicSkills) {
    for (const skill of parsed.data.topicSkills) {
      const topic = await prisma.topic.findUnique({
        where: { slug: skill.topicSlug },
      });
      if (!topic) {
        results.push(`Skipped unknown topic: ${skill.topicSlug}`);
        continue;
      }

      await prisma.userTopicSkill.upsert({
        where: { userId_topicId: { userId: admin.userId, topicId: topic.id } },
        create: {
          userId: admin.userId,
          topicId: topic.id,
          content: skill.content,
          format: skill.format ?? "markdown",
        },
        update: {
          content: skill.content,
          format: skill.format ?? "markdown",
        },
      });
      results.push(`Topic skill imported: ${skill.topicSlug}`);
    }
  }

  return NextResponse.json({ ok: true, results });
}
