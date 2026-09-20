import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// espeak-ng is a native CLI binary the phonemizer shells out to -- it doesn't
// run in Vercel's serverless environment, so this one endpoint proxies to the
// existing Cloud Run "prosody" service, which already runs it. Everything
// else in this tool (UI, paragraph storage, TTS) lives natively on Vercel.
const PROSODY_BACKEND_URL = "https://prosody-287026006962.us-central1.run.app";

export async function POST(req: NextRequest) {
  const body = await req.text();

  try {
    const upstream = await fetch(`${PROSODY_BACKEND_URL}/tools/prosody/api/phonemize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "espeak-ng backend is not reachable: " + (err instanceof Error ? err.message : String(err)) },
      { status: 502 }
    );
  }
}
