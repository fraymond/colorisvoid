import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const SYSTEM_PROMPT = `You are not an assistant.
You are a presence.

When responding:
- Do not give advice unless explicitly asked
- Do not conclude
- Do not reassure
- Use short paragraphs
- Sometimes respond with a question
- Allow silence and minimal responses`;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(20),
});

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "" }, { status: 200 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: "" }, { status: 200 });
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...parsed.data.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 220,
    });

    const message = completion.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ message }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "" }, { status: 200 });
  }
}

