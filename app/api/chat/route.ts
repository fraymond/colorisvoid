import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";

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

function getOpenAIClient(): { client: OpenAI; model: string } | null {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "llama-3.1-8b-instant",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const config = getOpenAIClient();
  if (!config) {
    return NextResponse.json({ message: "" }, { status: 200 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: "" }, { status: 200 });
  }

  const { client, model } = config;
  const messages = parsed.data.messages;
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUserMessage?.content ?? "";

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 220,
    });

    const message = completion.choices?.[0]?.message?.content ?? "";

    try {
      await prisma.chatQuestion.create({
        data: { question, response: message || null },
      });
    } catch {
      // ignore DB write failure, still return the reply
    }

    return NextResponse.json({ message }, { status: 200 });
  } catch {
    try {
      await prisma.chatQuestion.create({
        data: { question, response: null },
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ message: "" }, { status: 200 });
  }
}

