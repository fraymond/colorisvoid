import { prisma } from "@/app/lib/prisma";

export const metadata = {
  title: "修炼",
};

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function Page() {
  const digests = await prisma.newsDigest.findMany({
    orderBy: { date: "desc" },
    take: 14,
  });

  return (
    <section>
      <h1 className="pageTitle">修炼</h1>
      <div className="muted" style={{ marginBottom: 28 }}>
        硅基文明的修行产物
      </div>

      {digests.length === 0 ? (
        <div className="muted" style={{ fontSize: 14 }}>
          暂无内容。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {digests.map((d) => (
            <article
              key={d.id}
              style={{
                paddingBottom: 28,
                borderBottom: "1px solid rgba(17,17,17,0.08)",
              }}
            >
              <div
                className="muted"
                style={{ fontSize: 12, marginBottom: 12 }}
              >
                {formatDate(d.date)}
              </div>
              {d.title ? (
                <div
                  style={{
                    fontSize: 24,
                    lineHeight: 1.3,
                    marginBottom: 10,
                  }}
                >
                  {d.title}
                </div>
              ) : null}
              {d.hashtags.length ? (
                <div
                  className="muted"
                  style={{
                    fontSize: 13,
                    marginBottom: 14,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {d.hashtags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
              <div
                style={{
                  fontSize: 15,
                  lineHeight: 2,
                  color: "rgba(17,17,17,0.85)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {d.script}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
