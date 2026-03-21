import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/require-admin";

const actionSchema = z.object({
  action: z.enum(["activate", "archive"]),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ ruleSetId: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ruleSetId } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const existing = await prisma.newsDigestStyleRuleSet.findUnique({
    where: { id: ruleSetId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rule set not found" }, { status: 404 });
  }

  const ruleSet =
    parsed.data.action === "activate"
      ? await prisma.$transaction(async (tx) => {
          await tx.newsDigestStyleRuleSet.updateMany({
            where: { status: "ACTIVE", NOT: { id: ruleSetId } },
            data: { status: "ARCHIVED" },
          });

          return tx.newsDigestStyleRuleSet.update({
            where: { id: ruleSetId },
            data: {
              status: "ACTIVE",
              approvedAt: new Date(),
              approvedBy: admin.userId,
            },
          });
        })
      : await prisma.newsDigestStyleRuleSet.update({
          where: { id: ruleSetId },
          data: {
            status: "ARCHIVED",
          },
        });

  return NextResponse.json({
    ruleSet: {
      id: ruleSet.id,
      version: ruleSet.version,
      status: ruleSet.status,
      title: ruleSet.title,
      approvedAt: ruleSet.approvedAt?.toISOString() ?? null,
      approvedBy: ruleSet.approvedBy,
      updatedAt: ruleSet.updatedAt.toISOString(),
    },
  });
}
