import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_TTS_API_KEY is not configured on the server" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const ssml = body?.ssml;
  const languageCode = body?.languageCode;
  const speakingRate = body?.speakingRate;
  if (!ssml) {
    return NextResponse.json({ error: "ssml is required" }, { status: 400 });
  }
  const rate = Math.min(4.0, Math.max(0.25, Number(speakingRate) || 0.5));

  try {
    const ttsRes = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { ssml },
        voice: { languageCode: languageCode || "en-US" },
        audioConfig: { audioEncoding: "MP3", speakingRate: rate },
        enableTimePointing: ["SSML_MARK"],
      }),
    });

    if (!ttsRes.ok) {
      const details = await ttsRes.text();
      return NextResponse.json(
        { error: "Google TTS request failed", details },
        { status: 502 }
      );
    }

    const data = await ttsRes.json();
    return NextResponse.json({
      audioContent: data.audioContent,
      timepoints: data.timepoints || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
