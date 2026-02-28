import Link from "next/link";

import { prisma } from "@/app/lib/prisma";

export const metadata = {
  title: "顿悟",
};

export const dynamic = "force-dynamic";

function stripMarkdown(md: string): string {
  // Minimal, safe-enough excerpting: drop code fences, inline code, images/links, and most punctuation markers.
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_>~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(md: string, maxChars = 140): string {
  const text = stripMarkdown(md);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + "…";
}

function authorName(input: { authorDisplayName: string | null; authorEmail: string | null }): string {
  const dn = (input.authorDisplayName ?? "").trim();
  if (dn) return dn;
  const email = (input.authorEmail ?? "").trim();
  if (email) return email;
  return "佚名";
}

export default async function Page() {
  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      publicId: true,
      slug: true,
      title: true,
      body: true,
      publishedAt: true,
      authorEmail: true,
      authorDisplayName: true,
    },
  });

  return (
    <section>
      <h1 className="pageTitle">顿悟</h1>
      {stories.length === 0 ? (
        <div className="muted">此处暂空。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {stories.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid rgba(17,17,17,0.08)",
              }}
            >
              <Link href={`/stories/${encodeURIComponent(s.publicId ?? s.slug)}`} style={{ display: "block" }}>
                <div style={{ fontSize: 16 }}>{s.title}</div>
              </Link>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {authorName({ authorDisplayName: s.authorDisplayName, authorEmail: s.authorEmail })}
                {s.publishedAt ? ` · ${new Date(s.publishedAt).toLocaleDateString()}` : ""}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.85, color: "rgba(17,17,17,0.82)" }}>
                {excerpt(s.body)}
              </div>
              <div style={{ marginTop: 10 }}>
                <Link
                  className="muted"
                  href={`/stories/${encodeURIComponent(s.publicId ?? s.slug)}`}
                  style={{ fontSize: 13 }}
                >
                  【更多...】
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

