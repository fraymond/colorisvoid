import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "invalid slug")
    .optional(),
  body: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const story = await prisma.story.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ story });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.slug) {
    const exists = await prisma.story.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (exists && exists.id !== id) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
  }

  const existing = await prisma.story.findUnique({
    where: { id },
    select: { publishedAt: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const nextStatus = parsed.data.status ?? existing.status;
  const nextPublishedAt =
    nextStatus === "PUBLISHED"
      ? existing.publishedAt ?? new Date()
      : null;

  const story = await prisma.story.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      body: parsed.data.body,
      status: parsed.data.status,
      publishedAt: parsed.data.status ? nextPublishedAt : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: story.id });
}

