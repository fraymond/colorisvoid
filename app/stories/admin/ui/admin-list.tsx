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
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/stories");
      if (!r.ok) throw new Error(String(r.status));
      const json = (await r.json()) as { stories: StoryItem[] };
      setItems(json.stories);
    } catch {
      setError("无回应。");
    }
  };

  const importFromFolder = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stories/import", { method: "POST" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("无回应。");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
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
          disabled={busy}
          onClick={() => void importFromFolder()}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "transparent",
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
          }}
        >
          导入
        </button>
        <button
          type="button"
          onClick={() => void load()}
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

