import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";

import { isAdminAllowed } from "./admin-allowlist";
import { prisma } from "./prisma";
import WeChatProvider from "./providers/wechat";

const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: false,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID ?? "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
    }),
    WeChatProvider({
      clientId: process.env.WECHAT_CLIENT_ID ?? "",
      clientSecret: process.env.WECHAT_CLIENT_SECRET ?? "",
    }),
  ].filter((p: any) => {
    // Hide providers that are not configured (clientId/clientSecret empty).
    const id = String(p.id || "");
    if (id === "google") return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
    if (id === "facebook")
      return !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET;
    if (id === "wechat") return !!process.env.WECHAT_CLIENT_ID && !!process.env.WECHAT_CLIENT_SECRET;
    return true;
  }) as any,
  callbacks: {
    async signIn({ user, account }) {
      return isAdminAllowed({ email: user.email, account });
    },
    async jwt({ token, user, account }) {
      // Persist basic fields for middleware + server checks.
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if ((user as any)?.id) token.sub = (user as any).id;
      if (account?.provider) (token as any).provider = account.provider;
      if (account?.providerAccountId)
        (token as any).providerAccountId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.sub) (session.user as any).id = token.sub;
      return session;
    },
  },
};

