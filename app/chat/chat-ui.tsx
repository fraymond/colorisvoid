"use client";

import { useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatUi() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => text.trim().length > 0 && !busy, [text, busy]);

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;

    const next = [...messages, { role: "user", content } as const];
    setMessages(next);
    setText("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-12),
        }),
      });
      const json = (await res.json()) as { message?: string };
      const reply = (json?.message ?? "").trim();
      setMessages((m) => [...m, { role: "assistant", content: reply || "……" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "……" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: "42vh",
          padding: "4px 0",
        }}
      >
        {messages.length === 0 ? (
          <div className="muted" style={{ fontSize: 14 }}>
            你可以随便问一句。
          </div>
        ) : null}

        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "78%",
                whiteSpace: "pre-wrap",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(17,17,17,0.10)",
                background: "rgba(255,255,255,0.7)",
                color: "rgba(17,17,17,0.88)",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(17,17,17,0.08)",
          paddingTop: 16,
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="你可以随便问一句。"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          style={{
            flex: 1,
            resize: "none",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(17,17,17,0.12)",
            fontSize: 14,
            lineHeight: 1.7,
            outline: "none",
          }}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void send()}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid rgba(17,17,17,0.12)",
            background: "transparent",
            cursor: canSend ? "pointer" : "default",
            fontSize: 13,
            color: canSend ? "rgba(17,17,17,0.85)" : "rgba(17,17,17,0.35)",
          }}
        >
          送
        </button>
      </div>
    </div>
  );
}

