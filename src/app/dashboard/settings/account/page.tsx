"use client";

import { FormEvent, useState } from "react";

export default function AccountPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (password !== confirm) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, password_confirm: confirm })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "변경에 실패했습니다.");
        return;
      }
      setPassword("");
      setConfirm("");
      setMessage("비밀번호가 변경되었습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold text-slate-900">내 계정</h1>
      <p className="mt-1 text-sm text-slate-600">로그인한 계정에서 비밀번호를 변경할 수 있습니다.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">비밀번호 변경</h2>
        <label className="block text-sm">
          새 비밀번호
          <input
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          새 비밀번호 확인
          <input
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          변경
        </button>
      </form>
    </div>
  );
}
