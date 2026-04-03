"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopicLink = {
  slug: string;
  name: string;
  icon: string;
};

const TOPICS: TopicLink[] = [
  { slug: "ai-news", name: "AI News", icon: "📡" },
];

export function AdminSidebar() {
  const pathname = usePathname() || "/admin";

  return (
    <aside className="sidebar">
      <div className="sidebarTitle">CMS</div>
      <Link
        className={`sidebarLink ${pathname === "/admin" ? "sidebarLinkActive" : ""}`}
        href="/admin"
      >
        <span className="sidebarIcon">🏠</span>
        Dashboard
      </Link>
      <div className="sidebarTitle" style={{ marginTop: 12 }}>Topics</div>
      {TOPICS.map((topic) => (
        <Link
          key={topic.slug}
          className={`sidebarLink ${pathname.startsWith(`/admin/topics/${topic.slug}`) ? "sidebarLinkActive" : ""}`}
          href={`/admin/topics/${topic.slug}`}
        >
          <span className="sidebarIcon">{topic.icon}</span>
          {topic.name}
        </Link>
      ))}
      <div className="sidebarTitle" style={{ marginTop: 12 }}>Profile</div>
      <Link
        className={`sidebarLink ${pathname.startsWith("/admin/skills") ? "sidebarLinkActive" : ""}`}
        href="/admin/skills"
      >
        <span className="sidebarIcon">✍️</span>
        Writing Skills
      </Link>
    </aside>
  );
}
