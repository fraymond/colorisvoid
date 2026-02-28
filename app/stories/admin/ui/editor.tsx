"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StoryStatus = "DRAFT" | "PUBLISHED";

type Story = {
  id: string;
  title: string;
  slug: string;
  publicId?: string | null;
  body: string;
  status: StoryStatus;
  publishedAt: string | null;
  authorEmail?: string | null;
  authorDisplayName?: string | null;
};

export default function Editor(props: { mode: "new" } | { mode: "edit"; id: string }) {
  const mode = props.mode;
  const [story, setStory] = useState<Story | null>(
    mode === "new"
      ? {
          id: "",
          title: "",
          slug: "",
          publicId: null,
          body: "",
          status: "DRAFT",
          publishedAt: null,
          authorEmail: null,
          authorDisplayName: "",
        }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");

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
    return story.title.trim().length > 0;
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
            body: story.body,
            status: nextStatus ?? story.status,
            authorDisplayName: story.authorDisplayName,
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
          body: story.body,
          status: nextStatus,
          authorDisplayName: story.authorDisplayName,
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

  const remove = async () => {
    if (mode !== "edit" || !story) return;
    if (!confirm("删除后不可恢复。继续？")) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/stories/${encodeURIComponent(story.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      window.location.href = "/stories/admin";
    } catch {
      setMsg("无回应。");
    } finally {
      setSaving(false);
    }
  };

  const uploadImageAndInsert = async (file: File) => {
    if (!story) return;
    try {
      setSaving(true);
      setMsg(null);

      const fd = new FormData();
      fd.set("file", file);
      if (story.publicId) fd.set("publicId", story.publicId);
      const res = await fetch("/api/admin/images", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.url) throw new Error();

      const url = String(json.url);
      const insert = `![](${url})\n`;
      setStory((s) => (s ? { ...s, body: s.body + (s.body.endsWith("\n") ? "" : "\n") + insert } : s));
    } catch {
      setMsg("无回应。");
    } finally {
      setSaving(false);
    }
  };

  const togglePreview = async () => {
    if (!story) return;
    const next = !preview;
    setPreview(next);
    setMsg(null);
    if (!next) return;

    try {
      const res = await fetch("/api/admin/markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: story.body }),
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json?.html) throw new Error();
      setPreviewHtml(String(json.html));
    } catch {
      setPreviewHtml("<p>……</p>");
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
            href={`/stories/${encodeURIComponent(story.publicId ?? story.slug)}`}
            style={{ fontSize: 13 }}
          >
            观看
          </Link>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void togglePreview()}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "transparent",
            cursor: saving ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          {preview ? "写" : "预览"}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void remove()}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(17,17,17,0.12)",
              background: "transparent",
              cursor: saving ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            删除
          </button>
        ) : null}
      </div>

      <input
        value={story.title}
        onChange={(e) => {
          const title = e.target.value;
          setStory((s) => (s ? { ...s, title } : s));
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
        value={story.authorDisplayName ?? ""}
        onChange={(e) => setStory((s) => (s ? { ...s, authorDisplayName: e.target.value } : s))}
        placeholder="署名（可改）"
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(17,17,17,0.12)",
          fontSize: 13,
          letterSpacing: "0.02em",
          color: "rgba(17,17,17,0.82)",
        }}
      />

      {mode === "edit" ? (
        <div className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          用户名（email）：{story.authorEmail ?? "—"}
        </div>
      ) : null}

      {preview ? (
        <div
          className="prose"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "rgba(17,17,17,0.02)",
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <textarea
          value={story.body}
          onChange={(e) => setStory((s) => (s ? { ...s, body: e.target.value } : s))}
          placeholder="正文（Markdown）"
          rows={18}
          onPaste={(e) => {
            const item = e.clipboardData?.items?.[0];
            if (!item) return;
            if (!item.type || !item.type.startsWith("image/")) return;
            const file = item.getAsFile();
            if (!file) return;

            e.preventDefault();
            void uploadImageAndInsert(file);
          }}
          onDragOver={(e) => {
            const hasImage = Array.from(e.dataTransfer?.types ?? []).includes("Files");
            if (hasImage) e.preventDefault();
          }}
          onDrop={(e) => {
            const file = e.dataTransfer?.files?.[0];
            if (!file || !file.type.startsWith("image/")) return;

            e.preventDefault();
            void uploadImageAndInsert(file);
          }}
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
      )}

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

