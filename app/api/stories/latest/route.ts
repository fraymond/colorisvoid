import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const digests = await prisma.newsDigest.findMany({
    orderBy: { date: "desc" },
    take: 5,
    select: {
      date: true,
      title: true,
      storiesJson: true,
    },
  });

  const digest = digests.find((d) => d.storiesJson != null);

  if (!digest || !digest.storiesJson) {
    return NextResponse.json({ ok: false, reason: "no stories found" });
  }

  return NextResponse.json({
    ok: true,
    date: digest.date.toISOString().slice(0, 10),
    stories: digest.storiesJson,
  });
}
