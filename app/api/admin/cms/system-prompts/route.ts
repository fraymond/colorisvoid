import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";
import {
  NEWS_DIGEST_BASE_PROMPT,
  SYSTEM_PROMPT_SLUG_DIGEST,
} from "@/app/lib/news-digest";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prompts = await prisma.systemPrompt.findMany({
    orderBy: { slug: "asc" },
  });

  const slugs = prompts.map((p) => p.slug);
  const result = prompts.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    content: p.content,
    updatedAt: p.updatedAt.toISOString(),
    updatedBy: p.updatedBy,
  }));

  if (!slugs.includes(SYSTEM_PROMPT_SLUG_DIGEST)) {
    result.push({
      id: "",
      slug: SYSTEM_PROMPT_SLUG_DIGEST,
      name: "AI News Digest Base Prompt",
      content: NEWS_DIGEST_BASE_PROMPT,
      updatedAt: "",
      updatedBy: null,
    });
  }

  return NextResponse.json({ prompts: result });
}

const putSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
});

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const prompt = await prisma.systemPrompt.upsert({
    where: { slug: parsed.data.slug },
    create: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      content: parsed.data.content,
      updatedBy: admin.userId,
    },
    update: {
      name: parsed.data.name,
      content: parsed.data.content,
      updatedBy: admin.userId,
    },
  });

  return NextResponse.json({
    id: prompt.id,
    slug: prompt.slug,
    name: prompt.name,
    content: prompt.content,
    updatedAt: prompt.updatedAt.toISOString(),
    updatedBy: prompt.updatedBy,
  });
}
