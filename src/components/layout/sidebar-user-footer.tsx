"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SidebarUserFooterProps = {
  email: string | null;
};

export function SidebarUserFooter({ email }: SidebarUserFooterProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // 세션이 이미 없어도 로그인으로 이동
    } finally {
      // 하드 이동으로 뒤로가기 캐시 노출 최소화
      window.location.assign("/login");
    }
  }

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      {email ? (
        <p className="truncate text-xs font-medium text-slate-700" title={email}>
          {email}
        </p>
      ) : (
        <p className="text-2xs text-slate-400">OKESTRO Partner Portal</p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
        로그아웃
      </button>
    </div>
  );
}
