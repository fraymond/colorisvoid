"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StoryItem = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
};

export default function AdminList() {
  const [items, setItems] = useState<StoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetch("/api/admin/stories")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as { stories: StoryItem[] };
      })
      .then((json) => setItems(json.stories))
      .catch(() => setError("无回应。"));
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => items ?? [], [items]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Link
          href="/stories/admin/new"
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            fontSize: 13,
          }}
        >
          写
        </Link>
        <button
          type="button"
          onClick={load}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "transparent",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          看
        </button>
      </div>

      {error ? (
        <div className="muted">{error}</div>
      ) : items === null ? (
        <div className="muted">……</div>
      ) : sorted.length === 0 ? (
        <div className="muted">此处暂空。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((s) => (
            <Link
              key={s.id}
              href={`/stories/admin/${encodeURIComponent(s.id)}`}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid rgba(17,17,17,0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{s.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {s.status === "PUBLISHED" ? "已发布" : "草稿"}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                /stories/{s.slug}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

