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

  const staticPaths = ["/", "/chat", "/stories", "/notes", "/tools", "/portal"];

  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    select: { publicId: true, slug: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 500,
  });

  const urls = [
    ...staticPaths.map((p) => ({ loc: base + p, lastmod: null as string | null })),
    ...stories.map((s) => ({
      loc: `${base}/stories/${encodeURIComponent(s.publicId ?? s.slug)}`,
      lastmod: (s.publishedAt ?? s.updatedAt).toISOString(),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

