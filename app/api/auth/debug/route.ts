import { NextResponse } from "next/server";

/**
 * Diagnostic endpoint to check auth config (no secrets exposed).
 * Remove or protect this in production.
 */
export async function GET() {
  const checks = {
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_URL_value: process.env.NEXTAUTH_URL || "(not set)",
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "(not set)",
    ADMIN_EMAILS: !!process.env.ADMIN_EMAILS,
  };
  return NextResponse.json(checks);
}
