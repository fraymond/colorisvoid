import { notFound } from "next/navigation";

import { renderMarkdown } from "@/app/lib/markdown";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const story = await prisma.story.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, body: true, publishedAt: true },
  });

  if (!story) notFound();

  const html = await renderMarkdown(story.body);

  return (
    <article>
      <h1 className="pageTitle" style={{ letterSpacing: "0.06em" }}>
        {story.title}
      </h1>
      <div className="muted" style={{ fontSize: 12, marginTop: -14, marginBottom: 24 }}>
        {story.publishedAt ? new Date(story.publishedAt).toLocaleDateString() : ""}
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

