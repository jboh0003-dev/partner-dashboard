"use client";

import { useEffect, useState, useTransition } from "react";
import { InternalUsersBulkPanel } from "@/components/settings/internal-users-bulk-panel";
import { displayRoleLabel } from "@/lib/auth/roles";

type AccountRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  status: string;
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ko-KR");
}

export function UsersAdminPanel() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "admin">("viewer");
  const [password, setPassword] = useState("");

  function load() {
    startTransition(async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "목록을 불러오지 못했습니다.");
        return;
      }
      setRows(json.users ?? []);
      setCurrentUserId(json.current_user_id ?? null);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createUser() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "계정을 만들지 못했습니다.");
        return;
      }
      setOpen(false);
      setName("");
      setEmail("");
      setRole("viewer");
      setPassword("");
      load();
    });
  }

  function changeRole(userId: string, role: "viewer" | "admin") {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "역할을 변경하지 못했습니다.");
        return;
      }
      load();
    });
  }

  function deleteUser(userId: string) {
    if (!window.confirm("이 계정을 삭제할까요? 기존 데이터는 유지되고 로그인만 차단됩니다.")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "계정을 삭제하지 못했습니다.");
        return;
      }
      load();
    });
  }

  return (
    <div className="space-y-4">
      <InternalUsersBulkPanel onDone={load} />
      <div className="flex justify-end">
        <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>
          계정 추가
        </button>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">역할</th>
              <th className="px-3 py-2">생성일</th>
              <th className="px-3 py-2">최근 로그인</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelf = currentUserId === row.id;
              return (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.name || "—"}</td>
                <td className="px-3 py-2">{row.email || "—"}</td>
                <td className="px-3 py-2">
                  {isSelf ? (
                    displayRoleLabel(row.role)
                  ) : (
                    <select
                      className="rounded border px-2 py-1"
                      value={row.role === "admin" ? "admin" : "viewer"}
                      disabled={pending}
                      onChange={(e) => changeRole(row.id, e.target.value as "viewer" | "admin")}
                    >
                      <option value="viewer">사내 사용자</option>
                      <option value="admin">관리자</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">{formatWhen(row.created_at)}</td>
                <td className="px-3 py-2">{formatWhen(row.last_sign_in_at)}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">
                  {isSelf ? (
                    <span className="text-xs text-slate-400">본인</span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      disabled={pending}
                      onClick={() => deleteUser(row.id)}
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
            {!rows.length && !pending ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  등록된 계정이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">계정 추가</h2>
            <p className="mt-1 text-xs text-slate-500">사내 이메일로 계정을 만듭니다. 기본 역할은 사내 사용자입니다.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                이름
                <input className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm">
                회사 이메일
                <input className="mt-1 w-full rounded border px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block text-sm">
                역할
                <select className="mt-1 w-full rounded border px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as "viewer" | "admin")}>
                  <option value="viewer">사내 사용자</option>
                  <option value="admin">관리자</option>
                </select>
              </label>
              <label className="block text-sm">
                초기 비밀번호
                <input className="mt-1 w-full rounded border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white" disabled={pending} onClick={createUser}>
                생성
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
