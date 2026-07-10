"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { pickDuplicateMasterId, type DuplicateGroup } from "@/lib/contacts/duplicate-merge";
import { PartnerContactFormModal } from "@/components/partners/partner-contact-form-modal";
import { ContactsLoadError } from "@/components/contacts/contacts-load-error";
import type { PartnerContact } from "@/types/partner";

export function DuplicateMergePanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoGroups, setAutoGroups] = useState<DuplicateGroup[]>([]);
  const [manualGroups, setManualGroups] = useState<DuplicateGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<PartnerContact | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/contacts/duplicates");
      const json = (await response.json()) as {
        ok?: boolean;
        auto?: DuplicateGroup[];
        manual?: DuplicateGroup[];
        message?: string;
      };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "중복 후보를 불러오지 못했습니다.");
      }
      setAutoGroups(json.auto ?? []);
      setManualGroups(json.manual ?? []);
    } catch (fetchError) {
      setLoadError(
        fetchError instanceof Error ? fetchError.message : "중복 후보 조회 실패"
      );
      setAutoGroups([]);
      setManualGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDuplicates();
  }, [loadDuplicates]);

  const refresh = useCallback(() => {
    startTransition(() => {
      void loadDuplicates();
      router.refresh();
    });
  }, [loadDuplicates, router]);

  async function bulkAutoMerge() {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/contacts/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const json = (await response.json()) as {
      ok?: boolean;
      merged_groups?: number;
      merged_contacts?: number;
      errors?: string[];
      message?: string;
    };
    if (!response.ok || !json.ok) {
      setError(json.message ?? json.errors?.join(", ") ?? "일괄 병합 실패");
      return;
    }
    setMessage(
      `자동 병합 완료: ${json.merged_groups ?? 0}그룹, ${json.merged_contacts ?? 0}건`
    );
    refresh();
  }

  async function mergeGroup(group: DuplicateGroup) {
    const masterId = pickDuplicateMasterId(group);
    const secondaryIds = group.members.filter((member) => member.id !== masterId).map((m) => m.id);
    setError(null);
    const response = await fetch("/api/contacts/duplicates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "merge", master_id: masterId, secondary_ids: secondaryIds })
    });
    const json = (await response.json()) as { ok?: boolean; message?: string };
    if (!response.ok || !json.ok) {
      setError(json.message ?? "병합 실패");
      return;
    }
    setMessage(`${group.company_name} ${group.name} 병합 완료`);
    refresh();
  }

  async function keepSeparate(group: DuplicateGroup) {
    setError(null);
    const response = await fetch("/api/contacts/duplicates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "keep_separate",
        contact_ids: group.members.map((member) => member.id)
      })
    });
    const json = (await response.json()) as { ok?: boolean; message?: string };
    if (!response.ok || !json.ok) {
      setError(json.message ?? "처리 실패");
      return;
    }
    setMessage(`${group.company_name} ${group.name} — 별도 인물로 유지`);
    refresh();
  }

  async function openEdit(memberId: string) {
    const response = await fetch(`/api/contacts/${memberId}`);
    const json = (await response.json()) as {
      ok?: boolean;
      contact?: PartnerContact;
      message?: string;
    };
    if (!response.ok || !json.ok || !json.contact) {
      setError(json.message ?? "담당자 정보를 불러오지 못했습니다.");
      return;
    }
    setEditContact(json.contact);
    setFormOpen(true);
  }

  if (loadError) {
    return (
      <div className="mb-4">
        <ContactsLoadError title="중복 병합 후보를 불러오지 못했습니다" message={loadError} />
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => void loadDuplicates()}
            className="text-sm font-semibold text-violet-700 hover:underline"
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-violet-950">중복 병합 후보</h2>
            {loading ? (
              <p className="mt-1 text-xs text-violet-800">중복 후보 분석 중...</p>
            ) : (
              <p className="mt-1 text-xs text-violet-800">
                자동 병합 가능 {autoGroups.length}그룹 · 수동 확인 필요 {manualGroups.length}그룹
              </p>
            )}
          </div>
          {autoGroups.length > 0 ? (
            <button
              type="button"
              disabled={isPending || loading}
              onClick={() => void bulkAutoMerge()}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              자동 병합 가능 일괄 병합
            </button>
          ) : null}
        </div>

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        ) : null}

        {!loading && autoGroups.length > 0 ? (
          <DuplicateGroupSection
            title="자동 병합 가능"
            tone="auto"
            groups={autoGroups}
            disabled={isPending}
            onMerge={(group) => void mergeGroup(group)}
            onKeepSeparate={(group) => void keepSeparate(group)}
            onEdit={(id) => void openEdit(id)}
          />
        ) : null}

        {!loading && manualGroups.length > 0 ? (
          <DuplicateGroupSection
            title="수동 확인 필요"
            tone="manual"
            groups={manualGroups}
            disabled={isPending}
            onMerge={(group) => void mergeGroup(group)}
            onKeepSeparate={(group) => void keepSeparate(group)}
            onEdit={(id) => void openEdit(id)}
          />
        ) : null}

        {!loading && autoGroups.length === 0 && manualGroups.length === 0 ? (
          <p className="text-sm text-slate-600">현재 중복 병합 후보가 없습니다.</p>
        ) : null}
      </div>

      <PartnerContactFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditContact(null);
        }}
        contact={editContact}
        fullEdit
      />
    </>
  );
}

function DuplicateGroupSection({
  title,
  tone,
  groups,
  disabled,
  onMerge,
  onKeepSeparate,
  onEdit
}: {
  title: string;
  tone: "auto" | "manual";
  groups: DuplicateGroup[];
  disabled: boolean;
  onMerge: (group: DuplicateGroup) => void;
  onKeepSeparate: (group: DuplicateGroup) => void;
  onEdit: (memberId: string) => void;
}) {
  const badgeClass =
    tone === "auto"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-amber-100 text-amber-900";

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      {groups.map((group) => (
        <div
          key={group.person_key}
          className="rounded-xl border border-white bg-white p-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {group.company_name} · {group.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{group.reason}</p>
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
              >
                {tone === "auto" ? "자동 병합 가능" : "수동 확인 필요"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ActionButton disabled={disabled} onClick={() => onMerge(group)}>
                병합
              </ActionButton>
              <ActionButton disabled={disabled} onClick={() => onKeepSeparate(group)}>
                별도 유지
              </ActionButton>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {group.members.map((member, index) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">
                    {index === 0 ? "대표 후보" : `후보 ${index + 1}`}
                  </p>
                  <p className="text-slate-600">
                    {[member.department, member.position].filter(Boolean).join(" / ") || "-"}
                  </p>
                  <p className="text-slate-600">
                    {member.phone || "-"} · {member.email || "-"}
                  </p>
                  {member.role_raw ? (
                    <p className="text-slate-500">담당: {member.role_raw}</p>
                  ) : null}
                </div>
                <ActionButton disabled={disabled} onClick={() => onEdit(member.id)}>
                  수정
                </ActionButton>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
