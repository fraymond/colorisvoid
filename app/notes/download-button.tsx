"use client";

export function DownloadScriptButton({
  segment,
  filename,
}: {
  segment: string;
  filename: string;
}) {
  return (
    <button
      onClick={() => {
        const blob = new Blob([segment], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
      style={{
        flexShrink: 0,
        padding: "4px 10px",
        fontSize: 12,
        borderRadius: 6,
        border: "1px solid rgba(17,17,17,0.12)",
        background: "transparent",
        color: "rgba(17,17,17,0.5)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      下载口播
    </button>
  );
}
