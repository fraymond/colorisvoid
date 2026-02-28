import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const base =
    process.env.NEXTAUTH_URL ||
    "https://colorisvoid-zv43eo5m6a-uc.a.run.app";

  const items = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { publicId: true, slug: true, title: true, publishedAt: true, updatedAt: true },
    take: 50,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml("Colorisvoid · 顿悟")}</title>
    <link>${escapeXml(base + "/stories")}</link>
    <description>${escapeXml("顿悟：回望时的片刻")}</description>
    <language>zh-Hans</language>
    ${items
      .map((s) => {
        const key = s.publicId ?? s.slug;
        const link = `${base}/stories/${encodeURIComponent(key)}`;
        const pub = (s.publishedAt ?? s.updatedAt).toUTCString();
        return `<item>
  <title>${escapeXml(s.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid>${escapeXml(link)}</guid>
  <pubDate>${escapeXml(pub)}</pubDate>
</item>`;
      })
      .join("\n    ")}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

