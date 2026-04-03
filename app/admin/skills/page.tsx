"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = {
  id: string;
  content: string;
  format: string;
  updatedAt: string;
};

type TopicSkillEntry = {
  id: string;
  topicId: string;
  topicSlug: string;
  topicName: string;
  content: string;
  format: string;
  updatedAt: string;
};

export default function SkillsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topicSkills, setTopicSkills] = useState<TopicSkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState("");
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cms/skills");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.profile ?? null);
      setTopicSkills(data.topicSkills ?? []);
      setProfileDraft(data.profile?.content ?? "");
      const drafts: Record<string, string> = {};
      for (const s of data.topicSkills ?? []) {
        drafts[s.topicSlug] = s.content;
      }
      setTopicDrafts(drafts);
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

  const saveTopicSkill = async (topicSlug: string) => {
    setSaving(topicSlug);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/cms/skills/topics/${encodeURIComponent(topicSlug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: topicDrafts[topicSlug] ?? "" }),
      });
      if (!res.ok) throw new Error();
      await load();
      setMsg(`${topicSlug} skill saved.`);
    } catch {
      setMsg("Failed to save topic skill.");
    } finally {
      setSaving(null);
    }
  };

  const onExport = () => window.open("/api/admin/cms/skills/export", "_blank");

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

  if (loading) return <div className="muted">Loading...</div>;

  return (
    <>
      <div className="contentHeader">
        <h1 className="contentTitle">Writing Skills</h1>
        <div className="actionBar">
          <button type="button" className="btn" onClick={onExport}>
            Export All
          </button>
          <button type="button" className="btn" onClick={() => void onImport()}>
            Import
          </button>
          {msg && <span className="message">{msg}</span>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card">
          <div className="cardTitle">Main Writing Profile</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Your base writing style and preferences. Applied as a layer on top of the system prompt for all topics.
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

        <h2 style={{ fontSize: 16, fontWeight: 500, marginTop: 8 }}>Topic Sub-skills</h2>

        {topicSkills.length === 0 && (
          <div className="emptyState">
            No topic skills yet. Visit a topic workspace to create one, or import from a file.
          </div>
        )}

        {topicSkills.map((skill) => (
          <div key={skill.id} className="card">
            <div className="cardTitle">{skill.topicName}</div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Topic-specific preferences.
              {skill.updatedAt && ` Last updated: ${new Date(skill.updatedAt).toLocaleString("zh-CN")}`}
            </p>
            <textarea
              className="skillEditor"
              value={topicDrafts[skill.topicSlug] ?? ""}
              onChange={(e) =>
                setTopicDrafts((prev) => ({ ...prev, [skill.topicSlug]: e.target.value }))
              }
              placeholder={`${skill.topicName} specific instructions...`}
            />
            <div className="actionBar" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btnPrimary"
                disabled={saving === skill.topicSlug}
                onClick={() => void saveTopicSkill(skill.topicSlug)}
              >
                {saving === skill.topicSlug ? "Saving..." : `Save ${skill.topicName} Skill`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
