"use client";

import { useState, type FormEvent } from "react";
type Message = { role: "user" | "assistant"; content: string };

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-20), mode: "partner" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "응답 오류");
      setMessages([...next, { role: "assistant", content: data.answer || "답변을 생성하지 못했습니다." }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally { setLoading(false); }
  }
  return (
    <main className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col gap-4 p-4">
      <header><h1 className="text-2xl font-bold text-slate-900">파트너 데이터 AI</h1><p className="mt-1 text-sm text-slate-500">기존 Partner Connect 검색 자료를 근거로 답변합니다.</p></header>
      <section aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && <p className="text-sm text-slate-500">무엇이든 질문해보세요.</p>}
        {messages.map((message, index) => <div key={index} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-blue-600 text-white" : "bg-slate-100 text-slate-900"}`}>{message.content}</div>)}
        {loading && <p className="text-sm text-slate-500">답변을 작성하고 있습니다…</p>}
      </section>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <form onSubmit={submit} className="flex gap-2"><input aria-label="AI 질문" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900" value={input} onChange={event => setInput(event.target.value)} maxLength={4000} placeholder="질문을 입력하세요" /><button disabled={loading || !input.trim()} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">전송</button></form>
    </main>
  );
}
