import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ configured: Boolean(process.env.GOOGLE_TTS_API_KEY) });
}
