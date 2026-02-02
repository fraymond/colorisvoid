"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StoryStatus = "DRAFT" | "PUBLISHED";

type Story = {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: StoryStatus;
  publishedAt: string | null;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export default function Editor(props: { mode: "new" } | { mode: "edit"; id: string }) {
  const mode = props.mode;
  const [story, setStory] = useState<Story | null>(
    mode === "new"
      ? {
          id: "",
          title: "",
          slug: "",
          body: "",
          status: "DRAFT",
          publishedAt: null,
        }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit") return;
    fetch(`/api/admin/stories/${encodeURIComponent(props.id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as { story: Story };
      })
      .then((json) => setStory(json.story))
      .catch(() => setMsg("无回应。"));
  }, [mode, props]);

  const canPublish = useMemo(() => {
    if (!story) return false;
    return story.title.trim().length > 0 && story.slug.trim().length > 0;
  }, [story]);

  const save = async (nextStatus?: StoryStatus) => {
    if (!story) return;
    setSaving(true);
    setMsg(null);

    try {
      if (mode === "new") {
        const res = await fetch("/api/admin/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: story.title,
            slug: story.slug,
            body: story.body,
            status: nextStatus ?? story.status,
          }),
        });
        const json = (await res.json()) as any;
        if (!res.ok) {
          setMsg(json?.error === "slug_taken" ? "此名已被占用。" : "无回应。");
          return;
        }
        window.location.href = `/stories/admin/${encodeURIComponent(json.id)}`;
        return;
      }

      const res = await fetch(`/api/admin/stories/${encodeURIComponent(story.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: story.title,
          slug: story.slug,
          body: story.body,
          status: nextStatus,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) {
        setMsg(json?.error === "slug_taken" ? "此名已被占用。" : "无回应。");
        return;
      }
      setMsg("已记下。");
      if (nextStatus && story.status !== nextStatus) {
        setStory({ ...story, status: nextStatus });
      }
    } finally {
      setSaving(false);
    }
  };

  if (story === null) return <div className="muted">……</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link className="muted" href="/stories/admin" style={{ fontSize: 13 }}>
          返回
        </Link>
        {mode === "edit" && story.status === "PUBLISHED" ? (
          <Link
            className="muted"
            href={`/stories/${encodeURIComponent(story.slug)}`}
            style={{ fontSize: 13 }}
          >
            观看
          </Link>
        ) : null}
      </div>

      <input
        value={story.title}
        onChange={(e) => {
          const title = e.target.value;
          setStory((s) =>
            s
              ? {
                  ...s,
                  title,
                  slug: s.slug || slugify(title),
                }
              : s
          );
        }}
        placeholder="标题"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(17,17,17,0.12)",
          fontSize: 16,
        }}
      />

      <input
        value={story.slug}
        onChange={(e) => setStory((s) => (s ? { ...s, slug: slugify(e.target.value) } : s))}
        placeholder="slug (a-z0-9-)"
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(17,17,17,0.12)",
          fontSize: 13,
          letterSpacing: "0.04em",
          color: "rgba(17,17,17,0.82)",
        }}
      />

      <textarea
        value={story.body}
        onChange={(e) => setStory((s) => (s ? { ...s, body: e.target.value } : s))}
        placeholder="正文（Markdown）"
        rows={18}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(17,17,17,0.12)",
          fontSize: 14,
          lineHeight: 1.7,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        }}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => save()}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "transparent",
            cursor: saving ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          存
        </button>
        <button
          type="button"
          disabled={saving || !canPublish}
          onClick={() => save(story.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "transparent",
            cursor: saving || !canPublish ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          {story.status === "PUBLISHED" ? "撤回" : "发布"}
        </button>
        {msg ? (
          <span className="muted" style={{ fontSize: 13 }}>
            {msg}
          </span>
        ) : null}
      </div>
    </div>
  );
}

