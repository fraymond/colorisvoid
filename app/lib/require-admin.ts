import "server-only";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { isAdminAllowed } from "@/app/lib/admin-allowlist";

const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export type AdminContext = {
  userId: string;
  token: any;
};

export async function requireAdmin(req: NextRequest): Promise<AdminContext | null> {
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

