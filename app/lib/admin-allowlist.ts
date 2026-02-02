import type { Account } from "next-auth";

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

export function isAdminAllowed(input: {
  email?: string | null;
  account?: Account | null;
}): boolean {
  const email = input.email?.toLowerCase() ?? null;

  if (email) {
    if (allowedEmails.size > 0 && allowedEmails.has(email)) return true;
    if (allowedDomain && email.endsWith(`@${allowedDomain}`)) return true;
  }

  const provider = input.account?.provider ?? null;
  const providerAccountId = input.account?.providerAccountId?.toLowerCase() ?? null;
  if (!provider || !providerAccountId) return false;

  if (provider === "wechat" && allowedWechat.size > 0) {
    return allowedWechat.has(providerAccountId);
  }

  // next-auth uses provider id "facebook" for the Meta provider
  if (provider === "facebook" && allowedMeta.size > 0) {
    return allowedMeta.has(providerAccountId);
  }

  return false;
}

