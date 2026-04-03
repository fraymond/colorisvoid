"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  enrichedSummary: string | null;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  fetchedAt: string;
};

type Feedback = {
  id: string;
  createdBy: string;
  scoreOverall: number;
  scoreHumor: number;
  scoreHumanity: number;
  scoreClarity: number;
  scoreInsight: number;
  bestLine: string;
  worstIssue: string;
  rewriteHint: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

type Version = {
  id: string;
  version: number;
  title: string | null;
  script: string;
  status: "DRAFT" | "FINAL" | "PUBLISHED";
  createdBy: string;
  rewriteNote: string | null;
  model: string | null;
  createdAt: string;
};

type Digest = {
  id: string;
  date: string;
  title: string | null;
  hashtags: string[];
  script: string;
  pickedIds: string[];
  createdAt: string;
  feedbackAverage: {
    overall: number | null;
    humor: number | null;
    humanity: number | null;
    clarity: number | null;
    insight: number | null;
  };
  feedbacks: Feedback[];
  generationMeta: {
    id: string;
    model: string;
    basePromptVersion: string;
    ruleSetVersion: number | null;
  } | null;
  versions: Version[];
};

type Payload = {
  newsItems: NewsItem[];
  digests: Digest[];
  viewer: {
    userId: string;
    hasProfile: boolean;
    hasTopicSkill: boolean;
  };
};

type Tab = "raw" | "digest" | "versions" | "feedback" | "skills";

function formatDate(raw: string): string {
  return new Date(raw).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(raw: string): string {
  return new Date(raw).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function toDateString(iso: string): string {
  return iso.slice(0, 10);
}

export function AiNewsWorkspace({ topicId, topicName }: { topicId: string; topicName: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("digest");
  const [selectedDigestIdx, setSelectedDigestIdx] = useState(0);
  const [selectedNewsIds, setSelectedNewsIds] = useState<Set<string>>(new Set());
  const [rewriteNote, setRewriteNote] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newsDate, setNewsDate] = useState<string>("");

  const load = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = date ? `?date=${date}` : "";
      const res = await fetch(`/api/admin/cms/news${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Payload;
      setPayload(json);
      if (json.digests[0]) {
        setSelectedNewsIds(new Set(json.digests[0].pickedIds));
        if (!date) setNewsDate(toDateString(json.digests[0].date));
      }
    } catch {
      setError("Failed to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const digest = payload?.digests[selectedDigestIdx] ?? null;

  const onSelectDigest = useCallback(
    (idx: number) => {
      setSelectedDigestIdx(idx);
      const d = payload?.digests[idx];
      if (d) {
        setSelectedNewsIds(new Set(d.pickedIds));
        const dateStr = toDateString(d.date);
        setNewsDate(dateStr);
        void load(dateStr);
      }
    },
    [payload, load]
  );

  const onNewsDateChange = useCallback(
    (date: string) => {
      setNewsDate(date);
      if (date) void load(date);
    },
    [load]
  );

  const toggleNewsItem = useCallback((id: string) => {
    setSelectedNewsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const reload = useCallback(() => load(newsDate || undefined), [load, newsDate]);

  const onRewrite = useCallback(async () => {
    if (!digest || selectedNewsIds.size === 0) return;
    setRewriting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/cms/news/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digestId: digest.id,
          newsItemIds: Array.from(selectedNewsIds),
          rewriteNote: rewriteNote || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? String(res.status));
      }
      await reload();
      setMessage("New version generated.");
      setRewriteNote("");
      setTab("versions");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setRewriting(false);
    }
  }, [digest, selectedNewsIds, rewriteNote, reload]);

  const onVersionAction = useCallback(
    async (versionId: string, action: "publish" | "finalize" | "draft") => {
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/cms/news/versions/${encodeURIComponent(versionId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error();
        await reload();
        const labels = { publish: "Published", finalize: "Finalized", draft: "Reverted to draft" };
        setMessage(labels[action]);
      } catch {
        setMessage("Action failed.");
      }
    },
    [reload]
  );

  if (loading) return <div className="muted">Loading...</div>;
  if (error || !payload) return <div className="muted">{error ?? "No data."}</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "digest", label: "Deity Digest" },
    { key: "raw", label: "Raw News" },
    { key: "versions", label: `Versions${digest?.versions.length ? ` (${digest.versions.length})` : ""}` },
    { key: "feedback", label: "Feedback" },
    { key: "skills", label: "Skills" },
  ];

  return (
    <>
      <div className="contentHeader">
        <h1 className="contentTitle">{topicName}</h1>
        <div className="actionBar">
          <button type="button" className="btn" onClick={() => void reload()}>
            Refresh
          </button>
          {message ? <span className="message">{message}</span> : null}
        </div>
      </div>

      <DigestSelector
        digests={payload.digests}
        selectedIdx={selectedDigestIdx}
        onSelect={onSelectDigest}
      />

      <div className="tabBar">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? "tabActive" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "digest" && digest && <DigestPanel digest={digest} />}

      {tab === "raw" && (
        <RawNewsPanel
          newsItems={payload.newsItems}
          selectedIds={selectedNewsIds}
          onToggle={toggleNewsItem}
          rewriteNote={rewriteNote}
          onRewriteNoteChange={setRewriteNote}
          onRewrite={onRewrite}
          rewriting={rewriting}
          digestId={digest?.id}
          newsDate={newsDate}
          onNewsDateChange={onNewsDateChange}
        />
      )}

      {tab === "versions" && digest && (
        <VersionsPanel
          versions={digest.versions}
          onAction={onVersionAction}
          onRefresh={reload}
        />
      )}

      {tab === "feedback" && digest && (
        <FeedbackPanel digest={digest} viewerId={payload.viewer.userId} onRefresh={reload} />
      )}

      {tab === "skills" && <SkillsPanel topicId={topicId} />}
    </>
  );
}

function DigestSelector({
  digests,
  selectedIdx,
  onSelect,
}: {
  digests: Digest[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {digests.map((d, i) => (
        <button
          key={d.id}
          type="button"
          className={`btn ${i === selectedIdx ? "btnPrimary" : ""}`}
          onClick={() => onSelect(i)}
        >
          {formatShortDate(d.date)}
        </button>
      ))}
    </div>
  );
}

function DigestPanel({ digest }: { digest: Digest }) {
  const dateStr = toDateString(digest.date);

  const onDownload = () => {
    const blob = new Blob([digest.script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deity-digest-${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="metaGrid">
        <div className="metaItem">
          <span className="metaLabel">Date</span>
          <span className="metaValue">{formatDate(digest.date)}</span>
        </div>
        <div className="metaItem">
          <span className="metaLabel">Title</span>
          <span className="metaValue">{digest.title ?? "—"}</span>
        </div>
        <div className="metaItem">
          <span className="metaLabel">Model</span>
          <span className="metaValue">{digest.generationMeta?.model ?? "—"}</span>
        </div>
        <div className="metaItem">
          <span className="metaLabel">Rule Set</span>
          <span className="metaValue">
            {digest.generationMeta?.ruleSetVersion != null ? `v${digest.generationMeta.ruleSetVersion}` : "base only"}
          </span>
        </div>
        <div className="metaItem">
          <span className="metaLabel">Avg Score</span>
          <span className="metaValue">{digest.feedbackAverage.overall ?? "—"}</span>
        </div>
        <div className="metaItem">
          <span className="metaLabel">Versions</span>
          <span className="metaValue">{digest.versions.length}</span>
        </div>
      </div>

      {digest.hashtags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {digest.hashtags.map((tag) => (
            <span key={tag} className="muted" style={{ fontSize: 12 }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <button type="button" className="btn" onClick={onDownload}>
          Download as deity-digest-{dateStr}.txt
        </button>
      </div>

      <div className="card">
        <div className="digestScript">{digest.script}</div>
      </div>
    </div>
  );
}

function RawNewsPanel({
  newsItems,
  selectedIds,
  onToggle,
  rewriteNote,
  onRewriteNoteChange,
  onRewrite,
  rewriting,
  digestId,
  newsDate,
  onNewsDateChange,
}: {
  newsItems: NewsItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  rewriteNote: string;
  onRewriteNoteChange: (v: string) => void;
  onRewrite: () => void;
  rewriting: boolean;
  digestId: string | undefined;
  newsDate: string;
  onNewsDateChange: (date: string) => void;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div className="cardTitle" style={{ marginBottom: 0 }}>
            Selected {selectedIds.size} / {newsItems.length} items
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span className="muted">Date</span>
            <input
              type="date"
              className="scoreInputField"
              style={{ width: "auto", padding: "6px 10px" }}
              value={newsDate}
              onChange={(e) => onNewsDateChange(e.target.value)}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <textarea
            className="textareaField"
            rows={2}
            placeholder="Optional rewrite instructions..."
            value={rewriteNote}
            onChange={(e) => onRewriteNoteChange(e.target.value)}
          />
          <div className="actionBar" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={rewriting || selectedIds.size === 0 || !digestId}
              onClick={onRewrite}
            >
              {rewriting ? "Generating..." : "Generate Rewrite"}
            </button>
          </div>
        </div>
      </div>

      {newsItems.map((item) => (
        <NewsItemRow
          key={item.id}
          item={item}
          checked={selectedIds.has(item.id)}
          onToggle={() => onToggle(item.id)}
        />
      ))}

      {newsItems.length === 0 && (
        <div className="emptyState">No news items in the current window.</div>
      )}
    </div>
  );
}

function NewsItemRow({
  item,
  checked,
  onToggle,
}: {
  item: NewsItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const displaySummary = item.enrichedSummary || item.summary;

  return (
    <div className="newsItemRow" style={{ flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <input
          type="checkbox"
          className="newsItemCheckbox"
          checked={checked}
          onChange={onToggle}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="newsItemTitle"
            style={{ textDecoration: "underline", textDecorationColor: "rgba(17,17,17,0.15)", textUnderlineOffset: 3 }}
          >
            {item.title}
          </a>
          <div className="newsItemMeta">
            {item.sourceName} · {formatDate(item.publishedAt)}
          </div>
          {displaySummary && (
            <div className="newsItemSummary" style={{ whiteSpace: "pre-wrap" }}>
              {displaySummary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionsPanel({
  versions,
  onAction,
  onRefresh,
}: {
  versions: Version[];
  onAction: (id: string, action: "publish" | "finalize" | "draft") => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (v: Version) => {
    setExpandedId(v.id);
    setEditingId(v.id);
    setEditDraft(v.script);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (versionId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cms/news/versions/${encodeURIComponent(versionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: editDraft }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      setEditDraft("");
      await onRefresh();
    } catch {
      // keep editing open on failure
    } finally {
      setSaving(false);
    }
  };

  if (versions.length === 0) {
    return <div className="emptyState">No rewrite versions yet. Generate one from the Raw News tab.</div>;
  }

  return (
    <div>
      {versions.map((v) => {
        const badgeClass =
          v.status === "PUBLISHED"
            ? "badgePublished"
            : v.status === "FINAL"
              ? "badgeFinal"
              : "badgeDraft";
        const isExpanded = expandedId === v.id;
        const isEditing = editingId === v.id;

        return (
          <div key={v.id}>
            <div className="versionRow">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>v{v.version}</span>
                <span className={`versionBadge ${badgeClass}`}>{v.status}</span>
                {v.title ? (
                  <span className="muted" style={{ fontSize: 13 }}>
                    {v.title}
                  </span>
                ) : null}
              </div>
              <div className="actionBar">
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(v.createdAt).toLocaleString("zh-CN")}
                </span>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => {
                    if (isEditing) cancelEdit();
                    setExpandedId(isExpanded ? null : v.id);
                  }}
                >
                  {isExpanded ? "Collapse" : "View"}
                </button>
                {!isEditing && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => startEdit(v)}
                  >
                    Edit
                  </button>
                )}
                {v.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => void onAction(v.id, "publish")}
                  >
                    Publish
                  </button>
                )}
                {v.status === "DRAFT" && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => void onAction(v.id, "finalize")}
                  >
                    Finalize
                  </button>
                )}
                {v.status !== "DRAFT" && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => void onAction(v.id, "draft")}
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="card" style={{ marginBottom: 12, marginTop: -4 }}>
                {v.rewriteNote && (
                  <div style={{ fontSize: 13, color: "rgba(17,17,17,0.55)", marginBottom: 12 }}>
                    Rewrite note: {v.rewriteNote}
                  </div>
                )}
                {isEditing ? (
                  <>
                    <textarea
                      className="skillEditor"
                      style={{ minHeight: 300 }}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                    />
                    <div className="actionBar" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btnPrimary"
                        disabled={saving}
                        onClick={() => void saveEdit(v.id)}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button type="button" className="btn" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="digestScript">{v.script}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FeedbackPanel({
  digest,
  viewerId,
  onRefresh,
}: {
  digest: Digest;
  viewerId: string;
  onRefresh: () => Promise<void>;
}) {
  const existing = useMemo(
    () => digest.feedbacks.find((f) => f.createdBy === viewerId),
    [digest.feedbacks, viewerId]
  );

  const [form, setForm] = useState({
    scoreHumor: existing?.scoreHumor ?? 3,
    scoreHumanity: existing?.scoreHumanity ?? 3,
    scoreClarity: existing?.scoreClarity ?? 3,
    scoreInsight: existing?.scoreInsight ?? 3,
    bestLine: existing?.bestLine ?? "",
    worstIssue: existing?.worstIssue ?? "",
    rewriteHint: existing?.rewriteHint ?? "",
    comment: existing?.comment ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      scoreHumor: existing?.scoreHumor ?? 3,
      scoreHumanity: existing?.scoreHumanity ?? 3,
      scoreClarity: existing?.scoreClarity ?? 3,
      scoreInsight: existing?.scoreInsight ?? 3,
      bestLine: existing?.bestLine ?? "",
      worstIssue: existing?.worstIssue ?? "",
      rewriteHint: existing?.rewriteHint ?? "",
      comment: existing?.comment ?? "",
    });
  }, [existing]);

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/news/${encodeURIComponent(digest.id)}/feedback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      setMsg("Feedback saved.");
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const total = form.scoreHumor + form.scoreHumanity + form.scoreClarity + form.scoreInsight;

  return (
    <div className="card">
      <div className="cardTitle">Your Feedback — {total} / 20</div>

      <div className="feedbackGrid" style={{ marginBottom: 14 }}>
        {(
          [
            ["Humor", "scoreHumor"],
            ["Humanity", "scoreHumanity"],
            ["Clarity", "scoreClarity"],
            ["Insight", "scoreInsight"],
          ] as const
        ).map(([label, key]) => (
          <div className="scoreInput" key={key}>
            <span className="scoreInputLabel">{label}</span>
            <input
              type="number"
              min={0}
              max={5}
              className="scoreInputField"
              value={form[key]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [key]: Number(e.target.value || 0) }))
              }
            />
          </div>
        ))}
      </div>

      {(
        [
          ["Best line", "bestLine", 2],
          ["Worst issue", "worstIssue", 2],
          ["Rewrite hint", "rewriteHint", 2],
          ["Comment", "comment", 3],
        ] as const
      ).map(([label, key, rows]) => (
        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          <span className="scoreInputLabel">{label}</span>
          <textarea
            className="textareaField"
            rows={rows}
            value={form[key]}
            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
          />
        </label>
      ))}

      <div className="actionBar">
        <button type="button" className="btn btnPrimary" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving..." : "Save Feedback"}
        </button>
        {msg && <span className="message">{msg}</span>}
        {existing && (
          <span className="muted" style={{ fontSize: 12 }}>
            Last saved: {new Date(existing.updatedAt).toLocaleString("zh-CN")}
          </span>
        )}
      </div>
    </div>
  );
}

type SystemPromptData = {
  slug: string;
  name: string;
  content: string;
  updatedAt: string;
};

function SkillsPanel({ topicId }: { topicId: string }) {
  const [profile, setProfile] = useState<{ content: string; updatedAt: string } | null>(null);
  const [topicSkill, setTopicSkill] = useState<{ content: string; updatedAt: string } | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<SystemPromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsRes, promptsRes] = await Promise.all([
        fetch("/api/admin/cms/skills"),
        fetch("/api/admin/cms/system-prompts"),
      ]);
      if (!skillsRes.ok || !promptsRes.ok) throw new Error();
      const skillsData = await skillsRes.json();
      const promptsData = await promptsRes.json();

      setProfile(skillsData.profile);
      const aiSkill = skillsData.topicSkills?.find((s: any) => s.topicSlug === "ai-news") ?? null;
      setTopicSkill(aiSkill);
      setProfileDraft(skillsData.profile?.content ?? "");
      setTopicDraft(aiSkill?.content ?? "");

      const prompts: SystemPromptData[] = promptsData.prompts ?? [];
      setSystemPrompts(prompts);
      const drafts: Record<string, string> = {};
      for (const p of prompts) drafts[p.slug] = p.content;
      setPromptDrafts(drafts);
    } catch {
      setMsg("Failed to load skills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    setSaving("profile");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/cms/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: profileDraft }),
      });
      if (!res.ok) throw new Error();
      await load();
      setMsg("Main profile saved.");
    } catch {
      setMsg("Failed to save profile.");
    } finally {
      setSaving(null);
    }
  };

  const saveTopicSkill = async () => {
    setSaving("topic");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/cms/skills/topics/ai-news", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: topicDraft }),
      });
      if (!res.ok) throw new Error();
      await load();
      setMsg("AI News skill saved.");
    } catch {
      setMsg("Failed to save topic skill.");
    } finally {
      setSaving(null);
    }
  };

  const saveSystemPrompt = async (sp: SystemPromptData) => {
    const draft = promptDrafts[sp.slug];
    if (!draft) return;
    setSaving(`prompt-${sp.slug}`);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/cms/system-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: sp.slug, name: sp.name, content: draft }),
      });
      if (!res.ok) throw new Error();
      await load();
      setMsg(`${sp.name} saved.`);
    } catch {
      setMsg(`Failed to save ${sp.name}.`);
    } finally {
      setSaving(null);
    }
  };

  const onExport = () => {
    window.open("/api/admin/cms/skills/export", "_blank");
  };

  const onImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch("/api/admin/cms/skills/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        await load();
        setMsg("Skills imported.");
      } catch {
        setMsg("Import failed.");
      }
    };
    input.click();
  };

  if (loading) return <div className="muted">Loading skills...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="actionBar">
        <button type="button" className="btn" onClick={onExport}>
          Export All
        </button>
        <button type="button" className="btn" onClick={() => void onImport()}>
          Import
        </button>
        {msg && <span className="message">{msg}</span>}
      </div>

      {systemPrompts.map((sp) => (
        <div className="card" key={sp.slug}>
          <div className="cardTitle">{sp.name}</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            System-wide prompt used by the daily cron job and all rewrites.
            {sp.updatedAt && ` Last updated: ${new Date(sp.updatedAt).toLocaleString("zh-CN")}`}
          </p>
          <textarea
            className="skillEditor"
            rows={40}
            style={{ minHeight: 980 }}
            value={promptDrafts[sp.slug] ?? ""}
            onChange={(e) =>
              setPromptDrafts((prev) => ({ ...prev, [sp.slug]: e.target.value }))
            }
          />
          <div className="actionBar" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={saving === `prompt-${sp.slug}`}
              onClick={() => void saveSystemPrompt(sp)}
            >
              {saving === `prompt-${sp.slug}` ? "Saving..." : `Save ${sp.name}`}
            </button>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="cardTitle">Main Writing Profile</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Your base writing style and preferences. Applied to all topics.
          {profile?.updatedAt && ` Last updated: ${new Date(profile.updatedAt).toLocaleString("zh-CN")}`}
        </p>
        <textarea
          className="skillEditor"
          value={profileDraft}
          onChange={(e) => setProfileDraft(e.target.value)}
          placeholder="Describe your writing style, preferences, and voice..."
        />
        <div className="actionBar" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btnPrimary"
            disabled={saving === "profile"}
            onClick={() => void saveProfile()}
          >
            {saving === "profile" ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">AI News Sub-skill</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Topic-specific preferences for AI News digest writing.
          {topicSkill?.updatedAt && ` Last updated: ${new Date(topicSkill.updatedAt).toLocaleString("zh-CN")}`}
        </p>
        <textarea
          className="skillEditor"
          value={topicDraft}
          onChange={(e) => setTopicDraft(e.target.value)}
          placeholder="AI News specific instructions, style tweaks, rules..."
        />
        <div className="actionBar" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btnPrimary"
            disabled={saving === "topic"}
            onClick={() => void saveTopicSkill()}
          >
            {saving === "topic" ? "Saving..." : "Save AI News Skill"}
          </button>
        </div>
      </div>
    </div>
  );
}
