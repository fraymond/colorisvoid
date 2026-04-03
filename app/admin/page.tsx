import Link from "next/link";

import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const topics = await prisma.topic.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <div className="contentHeader">
        <h1 className="contentTitle">Dashboard</h1>
      </div>
      <div className="topicGrid">
        {topics.map((topic) => (
          <Link key={topic.id} href={`/admin/topics/${topic.slug}`} className="topicCard">
            <span className="topicCardIcon">{topic.icon ?? "📄"}</span>
            <span className="topicCardName">{topic.name}</span>
            {topic.description ? (
              <span className="topicCardDesc">{topic.description}</span>
            ) : null}
          </Link>
        ))}
        {topics.length === 0 ? (
          <div className="emptyState">No active topics yet.</div>
        ) : null}
      </div>
    </>
  );
}
