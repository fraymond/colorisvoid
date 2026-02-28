import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

export const runtime = "nodejs";

const frontSchema = z
  .object({
    title: z.string().optional(),
    slug: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    publishedAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function titleFromContent(filename: string, content: string) {
  // Prefer first markdown heading
  const lines = content.split(/\r?\n/);
  for (const l of lines) {
    const m = l.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  // Fallback to filename sans extension
  return filename.replace(/\.(md|mdx)$/i, "");
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dir = path.join(process.cwd(), "stories");
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(dir)).filter((f) => /\.(md|mdx)$/i.test(f));
  } catch {
    return NextResponse.json({ imported: [], skipped: [], error: "no_folder" }, { status: 200 });
  }

  const imported: Array<{ file: string; id: string; slug: string }> = [];
  const skipped: Array<{ file: string; reason: string }> = [];

  for (const file of entries) {
    const full = path.join(dir, file);
    const raw = await fs.readFile(full, "utf8").catch(() => null);
    if (raw === null) {
      skipped.push({ file, reason: "read_failed" });
      continue;
    }

    const parsedMatter = matter(raw);
    const fmParsed = frontSchema.safeParse(parsedMatter.data);
    const fm = fmParsed.success ? fmParsed.data : {};

    const body = String(parsedMatter.content ?? "").trim();
    const title = (fm.title?.trim() || titleFromContent(file, body)).trim();
    const slug = slugify((fm.slug?.trim() || title || file).trim() || file);

    if (!title || !slug) {
      skipped.push({ file, reason: "missing_title_or_slug" });
      continue;
    }

    const status = fm.status ?? "DRAFT";
    let publishedAt: Date | null = null;
    if (status === "PUBLISHED") {
      if (fm.publishedAt instanceof Date) publishedAt = fm.publishedAt;
      else if (typeof fm.publishedAt === "string") {
        const d = new Date(fm.publishedAt);
        publishedAt = Number.isNaN(d.getTime()) ? new Date() : d;
      } else publishedAt = new Date();
    }

    const existing = await prisma.story.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      await prisma.story.update({
        where: { id: existing.id },
        data: { title, body, status, publishedAt },
        select: { id: true },
      });
      imported.push({ file, id: existing.id, slug });
    } else {
      const created = await prisma.story.create({
        data: {
          title,
          slug,
          body,
          status,
          publishedAt,
          authorId: admin.userId,
        },
        select: { id: true },
      });
      imported.push({ file, id: created.id, slug });
    }
  }

  return NextResponse.json({ imported, skipped });
}

