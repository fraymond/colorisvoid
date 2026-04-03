import "server-only";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { isAdminAllowed } from "@/app/lib/admin-allowlist";
import { prisma } from "@/app/lib/prisma";

const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export type AdminContext = {
  userId: string;
  token: any;
};

const isDevBypass =
  process.env.NODE_ENV === "development" && process.env.BYPASS_AUTH === "true";

let _devUserId: string | null = null;
async function getDevUserId(): Promise<string> {
  if (_devUserId) return _devUserId;
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  _devUserId = user?.id ?? "dev-user";
  return _devUserId;
}

export async function requireAdmin(req: NextRequest): Promise<AdminContext | null> {
  if (isDevBypass) {
    return { userId: await getDevUserId(), token: { email: "dev@localhost" } };
  }

  const token = await getToken({ req, secret });
  if (!token) return null;
  const userId = typeof token.sub === "string" ? token.sub : null;
  if (!userId) return null;

  const ok = isAdminAllowed({
    email: typeof token.email === "string" ? token.email : null,
    account:
      typeof token.provider === "string" && typeof token.providerAccountId === "string"
        ? ({
            provider: token.provider,
            providerAccountId: token.providerAccountId,
          } as any)
        : null,
  });

  if (!ok) return null;

  return { userId, token };
}

