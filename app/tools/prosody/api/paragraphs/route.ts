import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { serializeParagraph } from "../../_lib/serialize";

export async function GET() {
  const rows = await prisma.prosodyParagraph.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json(rows.map(serializeParagraph));
}

const bodySchema = z.object({
  text: z.string(),
  title: z.string().optional(),
  language: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  const text = parsed.success ? parsed.data.text : "";
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const trimmedText = text.trim();
  const firstLine =
    trimmedText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0] || "Untitled";
  const rawTitle = parsed.success ? parsed.data.title : undefined;
  const finalTitle = (rawTitle && rawTitle.trim() ? rawTitle.trim() : firstLine).slice(0, 120);
  const language = (parsed.success && parsed.data.language) || "auto";

  const row = await prisma.prosodyParagraph.create({
    data: { title: finalTitle, text: trimmedText, language },
  });
  return NextResponse.json(serializeParagraph(row), { status: 201 });
}
