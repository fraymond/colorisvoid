import { notFound } from "next/navigation";

import { prisma } from "@/app/lib/prisma";

import { AiNewsWorkspace } from "../../ui/ai-news-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await prisma.topic.findUnique({ where: { slug } });
  return { title: topic?.name ?? "Topic" };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) notFound();

  if (topic.slug === "ai-news") {
    return <AiNewsWorkspace topicId={topic.id} topicName={topic.name} />;
  }

  return (
    <div className="emptyState">
      <p>{topic.name} workspace coming soon.</p>
    </div>
  );
}
