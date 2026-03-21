import Link from "next/link";

export const metadata = {
  title: "空门",
};

const links = [
  { name: "GitHub", href: "https://github.com/fraymond/colorisvoid/" },
];

export default function Page() {
  return (
    <section>
      <h1 className="pageTitle">空门</h1>
      <div className="muted" style={{ marginBottom: 22 }}>
        一座数字时代的禅院。
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "10px 0",
              borderBottom: "1px solid rgba(17,17,17,0.08)",
            }}
          >
            {l.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

