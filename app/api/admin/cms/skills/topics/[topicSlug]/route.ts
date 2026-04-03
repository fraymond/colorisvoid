import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const skillSchema = z.object({
  content: z.string().min(1).max(20000),
  format: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ topicSlug: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topicSlug } = await params;
  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } });
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const body = await req.json();
  const parsed = skillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const skill = await prisma.userTopicSkill.upsert({
    where: { userId_topicId: { userId: admin.userId, topicId: topic.id } },
    create: {
      userId: admin.userId,
      topicId: topic.id,
      content: parsed.data.content,
      format: parsed.data.format ?? "markdown",
    },
    update: {
      content: parsed.data.content,
      format: parsed.data.format ?? "markdown",
    },
  });

  return NextResponse.json({
    id: skill.id,
    topicId: skill.topicId,
    content: skill.content,
    format: skill.format,
    updatedAt: skill.updatedAt.toISOString(),
  });
}
