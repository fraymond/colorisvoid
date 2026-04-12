import { prisma } from "@/app/lib/prisma";
import type { StoryShape } from "@/app/lib/news-digest";
import { DownloadScriptButton } from "./download-button";
import Link from "next/link";

export const metadata = {
  title: "修炼",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 4;

function formatDate(d: Date): string {
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);

  const [digests, total] = await Promise.all([
    prisma.newsDigest.findMany({
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.newsDigest.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {digests.map((d) => {
              const stories = (d.storiesJson as StoryShape[] | null) ?? [];

              return (
                <div key={d.id}>
                  <div
                    className="muted"
                    style={{ fontSize: 12, marginBottom: 16 }}
                  >
                    {formatDate(d.date)}
                  </div>

                  {stories.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                      }}
                    >
                      {stories.map((story, i) => (
                        <article
                          key={i}
                          style={{
                            padding: "20px 24px",
                            borderRadius: 10,
                            background: "rgba(17,17,17,0.02)",
                            border: "1px solid rgba(17,17,17,0.06)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 12,
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 500 }}>
                              {story.title}
                            </div>
                            <DownloadScriptButton
                              story={story}
                              filename={`${d.date.toISOString().slice(0, 10)}-${i + 1}-${story.keyword}.json`}
                            />
                          </div>
                          {story.coverTitle ? (
                            <div
                              className="muted"
                              style={{ fontSize: 13, marginBottom: 10 }}
                            >
                              封面：{story.coverTitle}
                              {story.coverSubtitle
                                ? ` · ${story.coverSubtitle}`
                                : ""}
                            </div>
                          ) : null}
                          {story.hashtags?.length ? (
                            <div
                              className="muted"
                              style={{
                                fontSize: 12,
                                marginBottom: 12,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              {story.hashtags.map((tag) => (
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
                            {story.segment}
                          </div>
                          {story.copywriting ? (
                            <div
                              className="muted"
                              style={{
                                fontSize: 13,
                                marginTop: 12,
                                paddingTop: 10,
                                borderTop: "1px solid rgba(17,17,17,0.06)",
                              }}
                            >
                              文案：{story.copywriting}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <article
                      style={{
                        paddingBottom: 28,
                        borderBottom: "1px solid rgba(17,17,17,0.08)",
                      }}
                    >
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
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 48,
                paddingTop: 24,
                borderTop: "1px solid rgba(17,17,17,0.08)",
              }}
            >
              {page > 1 && (
                <Link
                  href={`/notes?page=${page - 1}`}
                  style={{
                    padding: "6px 14px",
                    fontSize: 14,
                    borderRadius: 6,
                    border: "1px solid rgba(17,17,17,0.12)",
                    color: "rgba(17,17,17,0.7)",
                    textDecoration: "none",
                  }}
                >
                  ← 更新
                </Link>
              )}
              <span
                className="muted"
                style={{ fontSize: 13, padding: "0 8px" }}
              >
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/notes?page=${page + 1}`}
                  style={{
                    padding: "6px 14px",
                    fontSize: 14,
                    borderRadius: 6,
                    border: "1px solid rgba(17,17,17,0.12)",
                    color: "rgba(17,17,17,0.7)",
                    textDecoration: "none",
                  }}
                >
                  更早 →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
