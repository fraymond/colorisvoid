"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { StoryShape } from "@/app/lib/news-digest";

type NewsItem = {
  id: string;
  title: string;
  sourceName: string;
  summary: string | null;
  enrichedSummary: string | null;
  publishedAt: string;
};

type DigestData = {
  id: string;
  date: string;
  stories: StoryShape[];
  pickedIds: string[];
};

type Payload = {
  digest: DigestData | null;
  availableNews: NewsItem[];
  dates: string[];
};

const btn: CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid rgba(17,17,17,0.12)",
  background: "transparent",
  cursor: "pointer",
};

const dangerBtn: CSSProperties = {
  ...btn,
  color: "#c0392b",
  borderColor: "rgba(192,57,43,0.3)",
};

const textarea: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(17,17,17,0.12)",
  fontSize: 14,
  lineHeight: 1.7,
  background: "transparent",
  resize: "vertical",
  fontFamily: "inherit",
};

const input: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(17,17,17,0.12)",
  fontSize: 14,
  background: "transparent",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      {children}
    </label>
  );
}

function StoryEditor({
  story,
  index,
  onChange,
  onDelete,
  onDownload,
  dateStr,
}: {
  story: StoryShape;
  index: number;
  onChange: (index: number, updated: StoryShape) => void;
  onDelete: (index: number) => void;
  onDownload: (story: StoryShape, index: number) => void;
  dateStr: string;
}) {
  const set = (patch: Partial<StoryShape>) => onChange(index, { ...story, ...patch });

  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: 12,
        border: "1px solid rgba(17,17,17,0.08)",
        background: "rgba(17,17,17,0.015)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>故事 {index + 1}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btn} onClick={() => onDownload(story, index)}>
            文字下载
          </button>
          <button type="button" style={dangerBtn} onClick={() => onDelete(index)}>
            删除
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="标题 (title)">
          <input style={input} value={story.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="关键词 (keyword)">
          <input style={input} value={story.keyword} onChange={(e) => set({ keyword: e.target.value })} />
        </Field>
      </div>

      <Field label="口播文本 (segment)">
        <textarea
          style={{ ...textarea, minHeight: 160 }}
          value={story.segment}
          onChange={(e) => set({ segment: e.target.value })}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="封面大字 (coverTitle)">
          <input style={input} value={story.coverTitle} onChange={(e) => set({ coverTitle: e.target.value })} />
        </Field>
        <Field label="封面小字 (coverSubtitle)">
          <input style={input} value={story.coverSubtitle} onChange={(e) => set({ coverSubtitle: e.target.value })} />
        </Field>
      </div>

      <Field label="文案 (copywriting)">
        <input style={input} value={story.copywriting} onChange={(e) => set({ copywriting: e.target.value })} />
      </Field>

      <Field label="Hashtags（逗号分隔）">
        <input
          style={input}
          value={story.hashtags.join(", ")}
          onChange={(e) =>
            set({ hashtags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
          }
        />
      </Field>
    </div>
  );
}

export default function NotesAdmin() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [stories, setStories] = useState<StoryShape[]>([]);
  const [digestId, setDigestId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState("");

  const load = useCallback(async (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    const res = await fetch(`/api/admin/digest-stories${qs}`);
    if (!res.ok) return;
    const data = (await res.json()) as Payload;
    setPayload(data);
    if (data.digest) {
      setStories(data.digest.stories);
      setDigestId(data.digest.id);
      setSelectedDate(data.digest.date);
    } else {
      setStories([]);
      setDigestId(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onSave = async () => {
    if (!digestId) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/digest-stories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, stories }),
      });
      if (!res.ok) throw new Error();
      setMessage("已保存");
    } catch {
      setMessage("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const onAddFromNews = async () => {
    if (!digestId || !selectedNewsId) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/digest-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, newsItemId: selectedNewsId }),
      });
      if (!res.ok) throw new Error();
      await load(selectedDate);
      setMessage("已添加");
      setSelectedNewsId("");
    } catch {
      setMessage("添加失败");
    } finally {
      setAdding(false);
    }
  };

  const onDelete = async (index: number) => {
    if (!digestId) return;
    if (!confirm(`确认删除故事 ${index + 1}？`)) return;
    setMessage(null);
    try {
      const res = await fetch("/api/admin/digest-stories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, storyIndex: index }),
      });
      if (!res.ok) throw new Error();
      await load(selectedDate);
      setMessage("已删除");
    } catch {
      setMessage("删除失败");
    }
  };

  const onChange = (index: number, updated: StoryShape) => {
    setStories((prev) => prev.map((s, i) => (i === index ? updated : s)));
  };

  const onDownload = (story: StoryShape, index: number) => {
    const blob = new Blob([JSON.stringify(story, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDate}-${index + 1}-${story.keyword}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!payload) return <div className="muted">加载中…</div>;
  if (!payload.digest) return <div className="muted">暂无内容。</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selectedDate}
          onChange={(e) => void load(e.target.value)}
          style={{ ...input, width: "auto" }}
        >
          {payload.dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <button type="button" style={btn} disabled={saving} onClick={onSave}>
          {saving ? "保存中…" : "保存全部"}
        </button>

        {message && <span className="muted" style={{ fontSize: 13 }}>{message}</span>}
      </div>

      {stories.map((story, i) => (
        <StoryEditor
          key={`${digestId}-${i}`}
          story={story}
          index={i}
          onChange={onChange}
          onDelete={onDelete}
          onDownload={onDownload}
          dateStr={selectedDate}
        />
      ))}

      <div
        style={{
          padding: "16px 20px",
          borderRadius: 12,
          border: "1px dashed rgba(17,17,17,0.15)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 14 }}>从新闻添加故事：</span>
        <select
          value={selectedNewsId}
          onChange={(e) => setSelectedNewsId(e.target.value)}
          style={{ ...input, width: "auto", flex: 1, minWidth: 200 }}
        >
          <option value="">选择新闻…</option>
          {payload.availableNews.map((n) => (
            <option key={n.id} value={n.id}>
              [{n.sourceName}] {n.title}
            </option>
          ))}
        </select>
        <button type="button" style={btn} disabled={adding || !selectedNewsId} onClick={onAddFromNews}>
          {adding ? "AI 生成故事中…" : "生成故事"}
        </button>
      </div>
    </div>
  );
}
