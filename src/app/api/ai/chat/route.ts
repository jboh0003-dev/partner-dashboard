import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const key = process.env.GROQ_API_KEY;
    if (!key) return NextResponse.json({ error: "AI 서비스 설정이 필요합니다." }, { status: 503 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("messages" in body)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const raw = (body as { messages: unknown }).messages;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return NextResponse.json({ error: "대화 길이를 확인해주세요." }, { status: 400 });
    const messages: ChatMessage[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object" || !("role" in item) || !("content" in item)) return NextResponse.json({ error: "잘못된 메시지입니다." }, { status: 400 });
      const { role, content } = item as { role: unknown; content: unknown };
      if ((role !== "user" && role !== "assistant") || typeof content !== "string" || content.length < 1 || content.length > 4000) return NextResponse.json({ error: "메시지 형식을 확인해주세요." }, { status: 400 });
      messages.push({ role, content });
    }
    if (messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "질문이 필요합니다." }, { status: 400 });
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: "당신은 Partner Connect의 한국어 AI 어시스턴트입니다. 일반 대화와 상식 질문에 정확하고 간결하게 답변하세요. 사내 DB나 문서에 접근하지 않은 상태에서는 내부 사실을 지어내지 말고 현재 조회할 수 없다고 알리세요." }, ...messages],
        max_completion_tokens: 900,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!upstream.ok) return NextResponse.json({ error: upstream.status === 429 ? "무료 API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." : "AI 응답에 실패했습니다." }, { status: upstream.status === 429 ? 429 : 502 });
    const result = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    return NextResponse.json({ answer: result.choices?.[0]?.message?.content ?? "" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "AI 요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
