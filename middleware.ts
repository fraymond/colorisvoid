import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const CANONICAL_HOST = "colorisvoid.com";

function parseCsv(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase())
  );
}

const allowedEmails = parseCsv(process.env.ADMIN_EMAILS);
const allowedWechat = parseCsv(process.env.ADMIN_WECHAT_OPENIDS);
const allowedMeta = parseCsv(process.env.ADMIN_META_IDS);
const allowedDomain = (process.env.ADMIN_EMAIL_DOMAIN || "").trim().toLowerCase();

function isAdminAllowedFromToken(token: any): boolean {
  const email = typeof token?.email === "string" ? token.email.toLowerCase() : null;
  if (email) {
    if (allowedEmails.size > 0 && allowedEmails.has(email)) return true;
    if (allowedDomain && email.endsWith(`@${allowedDomain}`)) return true;
  }

  const provider = typeof token?.provider === "string" ? token.provider : null;
  const providerAccountId =
    typeof token?.providerAccountId === "string"
      ? token.providerAccountId.toLowerCase()
      : null;
  if (!provider || !providerAccountId) return false;

  if (provider === "wechat" && allowedWechat.size > 0) {
    return allowedWechat.has(providerAccountId);
  }
  if (provider === "facebook" && allowedMeta.size > 0) {
    return allowedMeta.has(providerAccountId);
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = req.nextUrl.hostname;
  const rawHost =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.split(",")[0]?.trim() ||
    hostname;

  // Canonicalize host to avoid OAuth domain switching (www -> apex).
  if (process.env.NODE_ENV === "production" && rawHost === `www.${CANONICAL_HOST}`) {
    const url = req.nextUrl.clone();
    url.hostname = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const needsAdmin = pathname.startsWith("/stories/admin");
  if (!needsAdmin) return NextResponse.next();

  const token = await getToken({ req, secret });

  if (!token || !isAdminAllowedFromToken(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

