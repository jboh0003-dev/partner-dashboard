"use client";

import Image from "next/image";
import { useState } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("로그인 메일을 발송하는 중입니다.");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });

    if (error) {
      setStatus(`오류: ${error.message}`);
      return;
    }

    setStatus("메일함에서 로그인 링크를 확인하세요.");
  }

  return (
    <main className="relative min-h-screen">
      <Image
        src="/images/okestro-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-slate-950/70" aria-hidden />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex justify-center">
            <BrandLogo className="h-10 w-auto object-contain" priority />
          </div>

          <h1 className="text-center text-xl font-bold text-slate-950">
            파트너 대시보드 로그인
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            회사 메일을 입력하면 로그인 링크가 발송됩니다.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">이메일</label>
              <input
                type="email"
                required
                placeholder="name@okestro.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              로그인 링크 받기
            </button>
          </form>

          {status ? (
            <p className="mt-4 text-center text-sm text-slate-600">{status}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
