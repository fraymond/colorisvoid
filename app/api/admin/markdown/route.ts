import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { renderMarkdown } from "@/app/lib/markdown";
import { requireAdmin } from "@/app/lib/require-admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  markdown: z.string(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const html = await renderMarkdown(parsed.data.markdown);
  return NextResponse.json({ html });
}

