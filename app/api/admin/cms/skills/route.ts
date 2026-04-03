import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, topicSkills] = await Promise.all([
    prisma.userWritingProfile.findUnique({ where: { userId: admin.userId } }),
    prisma.userTopicSkill.findMany({
      where: { userId: admin.userId },
      include: { topic: { select: { slug: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    profile: profile
      ? {
          id: profile.id,
          content: profile.content,
          format: profile.format,
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    topicSkills: topicSkills.map((s) => ({
      id: s.id,
      topicId: s.topicId,
      topicSlug: s.topic.slug,
      topicName: s.topic.name,
      content: s.content,
      format: s.format,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}

const profileSchema = z.object({
  content: z.string().min(1).max(20000),
  format: z.string().optional(),
});

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const profile = await prisma.userWritingProfile.upsert({
    where: { userId: admin.userId },
    create: {
      userId: admin.userId,
      content: parsed.data.content,
      format: parsed.data.format ?? "markdown",
    },
    update: {
      content: parsed.data.content,
      format: parsed.data.format ?? "markdown",
    },
  });

  return NextResponse.json({
    id: profile.id,
    content: profile.content,
    format: profile.format,
    updatedAt: profile.updatedAt.toISOString(),
  });
}
