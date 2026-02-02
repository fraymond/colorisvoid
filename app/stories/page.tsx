import Link from "next/link";

import { prisma } from "@/app/lib/prisma";

export const metadata = {
  title: "顿悟",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { id: true, slug: true, title: true, publishedAt: true },
  });

  return (
    <section>
      <h1 className="pageTitle">顿悟</h1>
      {stories.length === 0 ? (
        <div className="muted">此处暂空。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {stories.map((s) => (
            <Link
              key={s.id}
              href={`/stories/${encodeURIComponent(s.slug)}`}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid rgba(17,17,17,0.08)",
              }}
            >
              <div style={{ fontSize: 16 }}>{s.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString() : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

