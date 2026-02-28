import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  authorDisplayName: z.string().trim().max(80).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const story = await prisma.story.findUnique({
    where: { id },
    select: {
      id: true,
      publicId: true,
      slug: true,
      title: true,
      body: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
      authorEmail: true,
      authorDisplayName: true,
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

  const existing = await prisma.story.findUnique({
    where: { id },
    select: { publishedAt: true, status: true, publicId: true, authorEmail: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const nextStatus = parsed.data.status ?? existing.status;
  const nextPublishedAt =
    nextStatus === "PUBLISHED"
      ? existing.publishedAt ?? new Date()
      : null;

  const email =
    existing.authorEmail ??
    (typeof admin.token?.email === "string" && admin.token.email.trim().length > 0
      ? admin.token.email.trim()
      : null);

  const story = await prisma.story.update({
    where: { id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      status: parsed.data.status,
      publishedAt: parsed.data.status ? nextPublishedAt : undefined,
      publicId: existing.publicId ?? randomUUID(),
      authorEmail: email,
      authorDisplayName: parsed.data.authorDisplayName,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: story.id });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.story.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.story.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

