import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  authorDisplayName: z.string().trim().max(80).optional(),
});

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function uniqueSlug(base: string): Promise<string> {
  const baseSlug = slugify(base) || "story";
  const first = await prisma.story.findUnique({ where: { slug: baseSlug }, select: { id: true } });
  if (!first) return baseSlug;

  // Try suffixes until free. (Typically very low iterations.)
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`;
    const exists = await prisma.story.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  // Fallback: timestamp-based
  return `${baseSlug}-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stories = await prisma.story.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      publicId: true,
      slug: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
      authorEmail: true,
      authorDisplayName: true,
    },
  });

  return NextResponse.json({ stories });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const slug = await uniqueSlug(parsed.data.title);

  const now = new Date();
  const status = parsed.data.status ?? "DRAFT";
  const email =
    typeof admin.token?.email === "string" && admin.token.email.trim().length > 0
      ? admin.token.email.trim()
      : null;
  const defaultDisplayName = email ?? "佚名";
  const authorDisplayName = (parsed.data.authorDisplayName ?? "").trim() || defaultDisplayName;

  const story = await prisma.story.create({
    data: {
      title: parsed.data.title,
      slug,
      body: parsed.data.body,
      status,
      publishedAt: status === "PUBLISHED" ? now : null,
      authorId: admin.userId,
      publicId: randomUUID(),
      authorEmail: email,
      authorDisplayName,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: story.id }, { status: 201 });
}

