import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const digest = await prisma.newsDigest.findFirst({
    where: { storiesJson: { not: null } },
    orderBy: { date: "desc" },
    select: {
      date: true,
      title: true,
      storiesJson: true,
    },
  });

  if (!digest || !digest.storiesJson) {
    return NextResponse.json({ ok: false, reason: "no stories found" });
  }

  return NextResponse.json({
    ok: true,
    date: digest.date.toISOString().slice(0, 10),
    stories: digest.storiesJson,
  });
}
