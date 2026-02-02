import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "invalid slug"),
  body: z.string().default(""),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stories = await prisma.story.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
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

  const exists = await prisma.story.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (exists) return NextResponse.json({ error: "slug_taken" }, { status: 409 });

  const now = new Date();
  const status = parsed.data.status ?? "DRAFT";

  const story = await prisma.story.create({
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      body: parsed.data.body,
      status,
      publishedAt: status === "PUBLISHED" ? now : null,
      authorId: admin.userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: story.id }, { status: 201 });
}

