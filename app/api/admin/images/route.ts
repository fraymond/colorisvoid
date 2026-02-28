import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireAdmin } from "@/app/lib/require-admin";

export const runtime = "nodejs";

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "bin";
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "missing_storage_config" }, { status: 500 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const file = form.get("file");
  const publicId = String(form.get("publicId") ?? "").trim();

  if (!file || typeof file === "string") return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (!(file instanceof Blob)) return NextResponse.json({ error: "invalid_file" }, { status: 400 });

  const mime = (file as any).type ? String((file as any).type) : "application/octet-stream";
  if (!mime.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "not_image" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length <= 0) return NextResponse.json({ error: "empty" }, { status: 400 });

  const ext = extFromMime(mime);
  const safeDir = publicId && publicId.length < 128 ? publicId : "tmp";
  const objectName = `${safeDir}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase.storage.from("stories").upload(objectName, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data } = supabase.storage.from("stories").getPublicUrl(objectName);
  return NextResponse.json({ url: data.publicUrl });
}
