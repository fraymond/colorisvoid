"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

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

type GenerationMeta = {
  id: string;
  model: string;
  basePromptVersion: string;
  ruleSetId: string | null;
  ruleSetVersion: number | null;
  feedbackWindowSummary: string | null;
  createdAt: string;
} | null;

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
  generationMeta: GenerationMeta;
};

type RuleSet = {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  title: string;
  sourceSummary: string;
  sourceFeedbackCount: number;
  model: string | null;
  moreToLeanInto: string[];
  lessToAvoid: string[];
  guardrails: string[];
  exampleWins: string[];
  exampleMisses: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

type AdminPayload = {
  digests: Digest[];
  ruleSets: RuleSet[];
  activeRuleSet: RuleSet | null;
  viewer: {
    userId: string;
  };
};

type FeedbackFormState = {
  scoreHumor: number;
  scoreHumanity: number;
  scoreClarity: number;
  scoreInsight: number;
  bestLine: string;
  worstIssue: string;
  rewriteHint: string;
  comment: string;
};

function formatDate(raw: string): string {
  return new Date(raw).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function initialForm(feedback?: Feedback): FeedbackFormState {
  return {
    scoreHumor: feedback?.scoreHumor ?? 3,
    scoreHumanity: feedback?.scoreHumanity ?? 3,
    scoreClarity: feedback?.scoreClarity ?? 3,
    scoreInsight: feedback?.scoreInsight ?? 3,
    bestLine: feedback?.bestLine ?? "",
    worstIssue: feedback?.worstIssue ?? "",
    rewriteHint: feedback?.rewriteHint ?? "",
    comment: feedback?.comment ?? "",
  };
}

function totalScore(form: FeedbackFormState): number {
  return form.scoreHumor + form.scoreHumanity + form.scoreClarity + form.scoreInsight;
}

function ScoreField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 100 }}>
      <span className="muted" style={{ fontSize: 12 }}>
        {props.label}
      </span>
      <input
        type="number"
        min={0}
        max={5}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value || 0))}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(17,17,17,0.12)",
          fontSize: 14,
          background: "transparent",
        }}
      />
    </label>
  );
}

function RuleSetCard(props: {
  ruleSet: RuleSet;
  onAction: (id: string, action: "activate" | "archive") => Promise<void>;
  busyActionId: string | null;
}) {
  const busy = props.busyActionId === props.ruleSet.id;

  return (
    <article
      style={{
        padding: 18,
        borderRadius: 16,
        border: "1px solid rgba(17,17,17,0.08)",
        background: props.ruleSet.status === "ACTIVE" ? "rgba(17,17,17,0.03)" : "transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16 }}>
            v{props.ruleSet.version} · {props.ruleSet.title}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {props.ruleSet.status} · 反馈样本 {props.ruleSet.sourceFeedbackCount} 条 ·{" "}
            {formatDate(props.ruleSet.createdAt)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {props.ruleSet.status !== "ACTIVE" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void props.onAction(props.ruleSet.id, "activate")}
              style={buttonStyle}
            >
              启用
            </button>
          ) : null}
          {props.ruleSet.status !== "ARCHIVED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void props.onAction(props.ruleSet.id, "archive")}
              style={buttonStyle}
            >
              归档
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.8, marginTop: 14 }}>{props.ruleSet.sourceSummary}</div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {(
          [
            ["多一点", props.ruleSet.moreToLeanInto],
            ["少一点", props.ruleSet.lessToAvoid],
            ["边界", props.ruleSet.guardrails],
            ["推荐方向", props.ruleSet.exampleWins],
            ["避免方向", props.ruleSet.exampleMisses],
          ] as Array<[string, string[]]>
        ).map(([label, items]) =>
          Array.isArray(items) && items.length ? (
            <div key={label}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((item) => (
                  <div key={item} style={{ fontSize: 14, lineHeight: 1.6 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </article>
  );
}

function DigestCard(props: {
  digest: Digest;
  viewerId: string;
  savingId: string | null;
  onSave: (digestId: string, form: FeedbackFormState) => Promise<void>;
}) {
  const existing = useMemo(
    () => props.digest.feedbacks.find((item) => item.createdBy === props.viewerId),
    [props.digest.feedbacks, props.viewerId]
  );
  const [form, setForm] = useState<FeedbackFormState>(() => initialForm(existing));

  useEffect(() => {
    setForm(initialForm(existing));
  }, [existing]);

  return (
    <article
      style={{
        paddingBottom: 28,
        borderBottom: "1px solid rgba(17,17,17,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            {formatDate(props.digest.date)}
          </div>
          {props.digest.title ? (
            <div style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 10 }}>{props.digest.title}</div>
          ) : null}
          {props.digest.hashtags.length ? (
            <div
              className="muted"
              style={{ fontSize: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}
            >
              {props.digest.hashtags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{props.digest.script}</div>
        </div>
        <div
          style={{
            minWidth: 240,
            borderRadius: 14,
            border: "1px solid rgba(17,17,17,0.08)",
            padding: 14,
            height: "fit-content",
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 10 }}>本期信息</div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>
            平均总分：{props.digest.feedbackAverage.overall ?? "—"}
            <br />
            模型：{props.digest.generationMeta?.model ?? "—"}
            <br />
            Base Prompt：{props.digest.generationMeta?.basePromptVersion ?? "—"}
            <br />
            规则版本：{props.digest.generationMeta?.ruleSetVersion ?? "base only"}
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(17,17,17,0.08)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14 }}>本期评分</div>
          <div className="muted" style={{ fontSize: 12 }}>
            当前总分：{totalScore(form)} / 20
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ScoreField
            label="幽默"
            value={form.scoreHumor}
            onChange={(scoreHumor) => setForm((prev) => ({ ...prev, scoreHumor }))}
          />
          <ScoreField
            label="人味"
            value={form.scoreHumanity}
            onChange={(scoreHumanity) => setForm((prev) => ({ ...prev, scoreHumanity }))}
          />
          <ScoreField
            label="清晰"
            value={form.scoreClarity}
            onChange={(scoreClarity) => setForm((prev) => ({ ...prev, scoreClarity }))}
          />
          <ScoreField
            label="观察"
            value={form.scoreInsight}
            onChange={(scoreInsight) => setForm((prev) => ({ ...prev, scoreInsight }))}
          />
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            今天最像献哥的一句
          </span>
          <textarea
            rows={2}
            value={form.bestLine}
            onChange={(e) => setForm((prev) => ({ ...prev, bestLine: e.target.value }))}
            style={textareaStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            今天最出戏的问题
          </span>
          <textarea
            rows={2}
            value={form.worstIssue}
            onChange={(e) => setForm((prev) => ({ ...prev, worstIssue: e.target.value }))}
            style={textareaStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            下次想多一点、少一点什么
          </span>
          <textarea
            rows={2}
            value={form.rewriteHint}
            onChange={(e) => setForm((prev) => ({ ...prev, rewriteHint: e.target.value }))}
            style={textareaStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            备注
          </span>
          <textarea
            rows={3}
            value={form.comment}
            onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            style={textareaStyle}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {existing ? `上次保存：${new Date(existing.updatedAt).toLocaleString("zh-CN")}` : "还没有你的评分。"}
          </div>
          <button
            type="button"
            disabled={props.savingId === props.digest.id}
            onClick={() => void props.onSave(props.digest.id, form)}
            style={buttonStyle}
          >
            {props.savingId === props.digest.id ? "保存中" : "保存评分"}
          </button>
        </div>
      </div>
    </article>
  );
}

const buttonStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(17,17,17,0.12)",
  background: "transparent",
  fontSize: 13,
  cursor: "pointer",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(17,17,17,0.12)",
  fontSize: 14,
  lineHeight: 1.7,
  background: "transparent",
};

export default function AdminReview() {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyRuleActionId, setBusyRuleActionId] = useState<string | null>(null);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [draftingRules, setDraftingRules] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/news");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as AdminPayload;
      setPayload(json);
    } catch {
      setError("没有拿到管理数据。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const historicalRuleSets = useMemo(
    () => payload?.ruleSets.filter((ruleSet) => ruleSet.id !== payload.activeRuleSet?.id) ?? [],
    [payload]
  );

  const onSaveFeedback = async (digestId: string, form: FeedbackFormState) => {
    setSavingId(digestId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/news/${encodeURIComponent(digestId)}/feedback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      await load();
      setMessage("评分已记下。");
    } catch {
      setMessage("评分没存进去。");
    } finally {
      setSavingId(null);
    }
  };

  const onGenerateRules = async () => {
    setDraftingRules(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/news/rules", { method: "POST" });
      if (!res.ok) throw new Error();
      await load();
      setMessage("新规则草案已经生成。");
    } catch {
      setMessage("规则草案生成失败。");
    } finally {
      setDraftingRules(false);
    }
  };

  const onRuleAction = async (id: string, action: "activate" | "archive") => {
    setBusyRuleActionId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/news/rules/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      await load();
      setMessage(action === "activate" ? "规则已启用。" : "规则已归档。");
    } catch {
      setMessage("规则状态更新失败。");
    } finally {
      setBusyRuleActionId(null);
    }
  };

  const onRunPipeline = async () => {
    setRunningPipeline(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/news", { method: "POST" });
      if (!res.ok) throw new Error();
      await load();
      setMessage("抓取和生成已触发。");
    } catch {
      setMessage("触发失败。");
    } finally {
      setRunningPipeline(false);
    }
  };

  if (loading) return <div className="muted">……</div>;
  if (error || !payload) return <div className="muted">{error ?? "暂无数据。"}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void load()} style={buttonStyle}>
          刷新
        </button>
        <button type="button" disabled={runningPipeline} onClick={() => void onRunPipeline()} style={buttonStyle}>
          {runningPipeline ? "生成中" : "重新抓取并生成"}
        </button>
        <button type="button" disabled={draftingRules} onClick={() => void onGenerateRules()} style={buttonStyle}>
          {draftingRules ? "归纳中" : "从评分生成规则草案"}
        </button>
        {message ? (
          <div className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
            {message}
          </div>
        ) : null}
      </div>

      <section
        style={{
          borderRadius: 18,
          border: "1px solid rgba(17,17,17,0.08)",
          padding: 18,
          background: "rgba(17,17,17,0.02)",
        }}
      >
        <div style={{ fontSize: 16, marginBottom: 10 }}>当前激活规则</div>
        {payload.activeRuleSet ? (
          <RuleSetCard
            ruleSet={payload.activeRuleSet}
            busyActionId={busyRuleActionId}
            onAction={onRuleAction}
          />
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>
            现在还是纯 base prompt，还没有激活任何学习规则。
          </div>
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16 }}>规则版本</div>
        {historicalRuleSets.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            还没有规则版本。
          </div>
        ) : (
          historicalRuleSets.map((ruleSet) => (
            <RuleSetCard
              key={ruleSet.id}
              ruleSet={ruleSet}
              busyActionId={busyRuleActionId}
              onAction={onRuleAction}
            />
          ))
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ fontSize: 16 }}>最近 14 期</div>
        {payload.digests.map((digest) => (
          <DigestCard
            key={digest.id}
            digest={digest}
            viewerId={payload.viewer.userId}
            savingId={savingId}
            onSave={onSaveFeedback}
          />
        ))}
      </section>
    </div>
  );
}
