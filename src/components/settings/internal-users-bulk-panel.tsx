"use client";

import { useState, useTransition } from "react";
import { INTERNAL_USER_BULK_PRESET } from "@/lib/auth/internal-users-bulk";

type PreviewItem = {
  email: string;
  name: string | null;
  role: string;
  action: "create_auth" | "create_profile" | "existing" | "error";
  message: string | null;
};

type CommitItem = {
  email: string;
  status: "created" | "profile_created" | "skipped" | "failed" | "cancelled";
  message: string | null;
};

type PreviewSummary = {
  total: number;
  create_auth: number;
  create_profile: number;
  existing: number;
  errors: number;
};

type CommitSummary = {
  created: number;
  profile_created: number;
  skipped: number;
  failed: number;
  cancelled: number;
};

export function InternalUsersBulkPanel({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(INTERNAL_USER_BULK_PRESET);
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ summary: PreviewSummary; items: PreviewItem[] } | null>(null);
  const [result, setResult] = useState<{ summary: CommitSummary; items: CommitItem[]; message: string | null } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function previewUsers() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: true, text })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "미리보기에 실패했습니다.");
        setPreview(null);
        return;
      }
      setPreview({ summary: json.summary, items: json.items ?? [] });
    });
  }

  function commitUsers() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false, text, password })
      });
      const json = await res.json();
      if (!json.dry_run && json.summary) {
        setResult({ summary: json.summary, items: json.items ?? [], message: json.message ?? null });
        onDone();
      }
      if (!json.ok) {
        setError(json.message || "일괄 생성에 실패했습니다.");
      }
    });
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">사내 사용자 일괄 등록</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            @okestro.com만 등록합니다. 확인 후 일괄 생성을 눌러야 계정이 만들어집니다.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-sm font-semibold"
          onClick={() => setOpen((value) => !value)}
        >
          사내 사용자 일괄 등록
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            초기 비밀번호
            <input
              className="mt-1 w-full max-w-xs rounded border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            이름,이메일,역할 (역할 생략 시 viewer)
            <textarea
              className="mt-1 h-48 w-full rounded border px-3 py-2 font-mono text-xs"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
                setResult(null);
              }}
            />
          </label>
          {error ? (
            <p className="whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              disabled={pending}
              onClick={previewUsers}
            >
              등록 전 확인
            </button>
            {preview ? (
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={pending}
                onClick={commitUsers}
              >
                일괄 생성
              </button>
            ) : null}
          </div>
          {preview ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              총 {preview.summary.total}명 · 신규 Auth 생성 {preview.summary.create_auth}명 · 기존 Auth 있음(프로필
              없음) {preview.summary.create_profile}명 · 기존 계정 {preview.summary.existing}명 · 오류{" "}
              {preview.summary.errors}명
            </div>
          ) : null}
          {result ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-800">
                생성 완료 {result.summary.created} · 프로필 보정 {result.summary.profile_created} · 기존 계정{" "}
                {result.summary.skipped} · 실패 {result.summary.failed}
                {result.summary.cancelled ? ` · 중단 ${result.summary.cancelled}` : ""}
              </p>
              {result.message ? (
                <p className="whitespace-pre-wrap text-sm text-red-700">{result.message}</p>
              ) : null}
              <ul className="max-h-40 overflow-auto text-xs text-slate-600">
                {result.items.map((item) => (
                  <li key={`${item.email}-${item.status}`}>
                    {item.email}: {item.status}
                    {item.message ? ` (${item.message})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
