import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const patchSchema = z.union([
  z.object({ action: z.enum(["publish", "finalize", "draft"]) }),
  z.object({ script: z.string().min(1) }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const version = await prisma.newsDigestVersion.findUnique({
    where: { id: versionId },
    include: { digest: true },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  if ("script" in parsed.data) {
    await prisma.newsDigestVersion.update({
      where: { id: versionId },
      data: { script: parsed.data.script },
    });
    return NextResponse.json({ ok: true });
  }

  const { action } = parsed.data;

  const statusMap = {
    publish: "PUBLISHED" as const,
    finalize: "FINAL" as const,
    draft: "DRAFT" as const,
  };
  const newStatus = statusMap[action];

  if (action === "publish") {
    await prisma.$transaction([
      prisma.newsDigestVersion.updateMany({
        where: { digestId: version.digestId, status: "PUBLISHED" },
        data: { status: "FINAL" },
      }),
      prisma.newsDigestVersion.update({
        where: { id: versionId },
        data: { status: newStatus },
      }),
      prisma.newsDigest.update({
        where: { id: version.digestId },
        data: {
          title: version.title,
          hashtags: version.hashtags,
          script: version.script,
          pickedIds: version.pickedIds,
        },
      }),
    ]);
  } else {
    await prisma.newsDigestVersion.update({
      where: { id: versionId },
      data: { status: newStatus },
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
