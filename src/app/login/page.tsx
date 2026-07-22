"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { mapAuthErrorMessage, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/errors";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(
    () => getSafeRedirectPath(searchParams.get("redirect"), "/dashboard"),
    [searchParams]
  );
  const expired = searchParams.get("reason") === "expired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? SESSION_EXPIRED_MESSAGE : null
  );

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) {
        setError(mapAuthErrorMessage(signInError));
        setLoading(false);
        return;
      }

      // 쿠키 세션이 middleware/server에 확실히 반영되도록 풀 네비게이션
      window.location.assign(redirectTo);    } catch {
      setError("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
      <div className="mb-6 flex justify-center">
        <BrandLogo className="h-10 w-auto object-contain" priority />
      </div>

      <h1 className="text-center text-xl font-bold text-slate-950">파트너 대시보드</h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        승인된 사내 계정으로 로그인하세요.
      </p>

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
            이메일
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="username"
            required
            placeholder="name@okestro.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-okestro-600 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <div className="relative mt-2">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-okestro-600 disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-okestro-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-okestro-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              로그인 중…
            </>
          ) : (
            "로그인"
          )}
        </button>
      </form>
    </section>
  );
}

function LoginFallback() {
  return (
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        로그인 화면을 불러오는 중…
      </div>
    </section>
  );
}

export default function LoginPage() {
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
        <Suspense fallback={<LoginFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
