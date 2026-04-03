import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId: admin.userId,
    mainProfile: profile
      ? { content: profile.content, format: profile.format }
      : null,
    topicSkills: topicSkills.map((s) => ({
      topicSlug: s.topic.slug,
      topicName: s.topic.name,
      content: s.content,
      format: s.format,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="writing-skills-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
