"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavKey = "preface" | "chat" | "stories" | "notes" | "tools" | "portal";

function getActiveKey(pathname: string): NavKey {
  if (pathname === "/") return "preface";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/stories")) return "stories";
  if (pathname.startsWith("/notes")) return "notes";
  if (pathname.startsWith("/tools")) return "tools";
  return "portal";
}

export function Nav() {
  const pathname = usePathname() || "/";
  const active = getActiveKey(pathname);

  return (
    <nav className="nav" aria-label="主导航">
      <Link className="navLink" href="/#preface" aria-current={active === "preface" ? "page" : undefined}>
        缘起
      </Link>
      <Link className="navLink" href="/chat" aria-current={active === "chat" ? "page" : undefined}>
        问道
      </Link>
      <Link className="navLink" href="/stories" aria-current={active === "stories" ? "page" : undefined}>
        顿悟
      </Link>
      <Link className="navLink" href="/notes" aria-current={active === "notes" ? "page" : undefined}>
        修炼
      </Link>
      <Link className="navLink" href="/tools" aria-current={active === "tools" ? "page" : undefined}>
        法器
      </Link>
      <Link className="navLink" href="/portal" aria-current={active === "portal" ? "page" : undefined}>
        空门
      </Link>
    </nav>
  );
}

