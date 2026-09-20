import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { serializeParagraph } from "../../../_lib/serialize";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = await prisma.prosodyParagraph.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeParagraph(row));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (id !== null) {
    await prisma.prosodyParagraph.deleteMany({ where: { id } });
  }
  return new NextResponse(null, { status: 204 });
}
