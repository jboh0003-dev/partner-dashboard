"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Loader2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SidebarUserFooterProps = {
  name?: string | null;
  email: string | null;
  roleLabel?: string | null;
};

export function SidebarUserFooter({ name, email, roleLabel }: SidebarUserFooterProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);

    try {
      const supabase = createClient();
      // 다른 PC/브라우저의 동일 계정 세션까지 끊지 않고,
      // 현재 브라우저의 세션만 제거한다.
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // 로그인 쿠키가 이미 만료됐더라도 로그인 화면으로 이동한다.
    } finally {
      window.location.replace("/login?signedOut=1");
    }
  }

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      {name || email ? (
        <div className="min-w-0">
          {name ? <p className="truncate text-sm font-semibold text-slate-800">{name}</p> : null}
          {email ? (
            <p className="truncate text-xs text-slate-600" title={email}>
              {email}
            </p>
          ) : null}
          {roleLabel ? <p className="mt-0.5 text-[11px] font-medium text-slate-500">{roleLabel}</p> : null}
        </div>
      ) : (
        <p className="text-2xs text-slate-400">OKESTRO Partner Connect</p>
      )}
      <div className="mt-3 space-y-1.5">
        <Link
          href="/dashboard/settings/account"
          prefetch={false}
          className="inline-flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <UserRound size={13} />
          내 계정
        </Link>
        <Link
          href="/dashboard/settings/account"
          prefetch={false}
          className="inline-flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <KeyRound size={13} />
          비밀번호 변경
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          로그아웃
        </button>
      </div>
    </div>
  );
}
