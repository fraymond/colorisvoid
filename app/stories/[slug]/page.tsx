import { notFound, redirect } from "next/navigation";

import { renderMarkdown } from "@/app/lib/markdown";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { slug: key } = await Promise.resolve(params as any);

  const story =
    (await prisma.story.findFirst({
      where: { publicId: key, status: "PUBLISHED" },
      select: { title: true },
    })) ??
    (await prisma.story.findFirst({
      where: { slug: key, status: "PUBLISHED" },
      select: { title: true },
    }));

  if (!story) return { title: "顿悟" };
  return { title: story.title };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const { slug: key } = await Promise.resolve(params as any);

  // #region agent log
  console.log(
    JSON.stringify({
      sessionId: "debug-session",
      runId: "run2",
      hypothesisId: "H_story_lookup",
      location: "app/stories/[slug]/page.tsx:entry",
      message: "Story page lookup start",
      data: { key },
      timestamp: Date.now(),
    })
  );
  // #endregion

  const byPublicId = await prisma.story.findFirst({
    where: { publicId: key, status: "PUBLISHED" },
    select: { title: true, body: true, publishedAt: true, publicId: true, slug: true },
  });

  // #region agent log
  console.log(
    JSON.stringify({
      sessionId: "debug-session",
      runId: "run2",
      hypothesisId: "H_story_lookup",
      location: "app/stories/[slug]/page.tsx:byPublicId",
      message: "Story page byPublicId result",
      data: {
        key,
        found: Boolean(byPublicId),
        publicId: byPublicId?.publicId ?? null,
        slug: byPublicId?.slug ?? null,
        title: byPublicId?.title ?? null,
      },
      timestamp: Date.now(),
    })
  );
  // #endregion

  const bySlug =
    byPublicId ??
    (await prisma.story.findFirst({
      where: { slug: key, status: "PUBLISHED" },
      select: { title: true, body: true, publishedAt: true, publicId: true, slug: true },
    }));

  // #region agent log
  console.log(
    JSON.stringify({
      sessionId: "debug-session",
      runId: "run2",
      hypothesisId: "H_story_lookup",
      location: "app/stories/[slug]/page.tsx:bySlug",
      message: "Story page bySlug fallback result",
      data: {
        key,
        usedFallback: !byPublicId,
        found: Boolean(bySlug),
        publicId: bySlug?.publicId ?? null,
        slug: bySlug?.slug ?? null,
        title: bySlug?.title ?? null,
      },
      timestamp: Date.now(),
    })
  );
  // #endregion

  if (!bySlug) notFound();

  // Canonicalize legacy URLs: /stories/<slug> -> /stories/<publicId>
  if (!byPublicId && bySlug.publicId && bySlug.publicId !== key) {
    redirect(`/stories/${encodeURIComponent(bySlug.publicId)}`);
  }

  const html = await renderMarkdown(bySlug.body);

  return (
    <article>
      <h1 className="pageTitle" style={{ letterSpacing: "0.06em" }}>
        {bySlug.title}
      </h1>
      <div className="muted" style={{ fontSize: 12, marginTop: -14, marginBottom: 24 }}>
        {bySlug.publishedAt ? new Date(bySlug.publishedAt).toLocaleDateString() : ""}
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

