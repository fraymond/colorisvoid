"use client";

import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type ProviderRecord = Record<
  string,
  { id: string; name: string; type: string; signinUrl: string; callbackUrl: string }
>;

function prettyName(id: string, fallback: string) {
  if (id === "google") return "Google";
  if (id === "facebook") return "Meta";
  if (id === "wechat") return "WeChat";
  return fallback;
}

export default function SignIn() {
  const [providers, setProviders] = useState<ProviderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers")
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        return (await r.json()) as ProviderRecord;
      })
      .then((p) => {
        if (!cancelled) setProviders(p);
      })
      .catch(() => {
        if (!cancelled) setError("无门。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo(() => {
    if (!providers) return [];
    return Object.values(providers).filter((p) => p.type === "oauth");
  }, [providers]);

  return (
    <section style={{ paddingTop: 24 }}>
      <h1 className="pageTitle">登录</h1>
      <div className="muted" style={{ fontSize: 14, marginBottom: 26 }}>
        只对被允许的人开启。
      </div>

      {error ? (
        <div className="muted">{error}</div>
      ) : providers === null ? (
        <div className="muted">……</div>
      ) : list.length === 0 ? (
        <div className="muted">此刻无门。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => signIn(p.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(17,17,17,0.12)",
                background: "rgba(255,255,255,0.7)",
                cursor: "pointer",
              }}
            >
              {prettyName(p.id, p.name)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

