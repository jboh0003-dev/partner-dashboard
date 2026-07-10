"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyToast } from "@/components/common/copy-toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ContactTagsBadges } from "@/components/contacts/contact-tags-badges";
import { EmptyState } from "@/components/common/empty-state";
import { PartnerContactFormModal } from "@/components/partners/partner-contact-form-modal";
import { inferContactTags } from "@/lib/contacts/contact-tags";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import type { PartnerContact } from "@/types/partner";

type PartnerOrganizationAdminPanelProps = {
  partnerId: string;
  contacts: PartnerContact[];
  inactiveContacts?: PartnerContact[];
};

export function PartnerOrganizationAdminPanel({
  partnerId,
  contacts,
  inactiveContacts = []
}: PartnerOrganizationAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerContact | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const sortedContacts = useMemo(
    () =>
      [...contacts].sort((left, right) => {
        if (left.is_contract_contact !== right.is_contract_contact) {
          return left.is_contract_contact ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "ko-KR");
      }),
    [contacts]
  );

  const sortedInactiveContacts = useMemo(
    () =>
      [...inactiveContacts].sort((left, right) =>
        left.name.localeCompare(right.name, "ko-KR")
      ),
    [inactiveContacts]
  );

  const contractContactCount = sortedContacts.filter((contact) => contact.is_contract_contact).length;

  function openCreate() {
    setEditingContact(null);
    setModalOpen(true);
  }

  function openEdit(contact: PartnerContact) {
    setEditingContact(contact);
    setModalOpen(true);
  }

  function handleDelete(contact: PartnerContact) {
    setDeleteTarget(contact);
  }

  function runDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setDeleteTarget(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "삭제에 실패했습니다.");
        return;
      }
      setToast("삭제되었습니다.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <CopyToast message={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-slate-500">현재 인력/담당자 {sortedContacts.length}명</p>
          {inactiveContacts.length > 0 ? (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="rounded border-slate-300"
              />
              과거 담당자/비활성 인력 보기 ({inactiveContacts.length}명)
            </label>
          ) : null}
        </div>
        <button type="button" onClick={openCreate} className="ui-btn-primary text-sm">
          담당자 추가
        </button>
      </div>

      {contractContactCount === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
          계약담당자 미지정
        </div>
      ) : contractContactCount > 1 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
          계약담당자 복수 지정 ({contractContactCount}명)
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {sortedContacts.length === 0 ? (
        <EmptyState
          title="등록된 현재 담당자가 없습니다."
          description="담당자 추가 버튼으로 영업·엔지니어·계약담당자 정보를 등록할 수 있습니다."
        />
      ) : (
        <ContactTable
          contacts={sortedContacts}
          onEdit={openEdit}
          onDelete={handleDelete}
          isPending={isPending}
        />
      )}

      {showInactive && inactiveContacts.length > 0 ? (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-semibold text-slate-700">과거 담당자 / 비활성 인력</p>
          <ContactTable
            contacts={sortedInactiveContacts}
            onEdit={openEdit}
            onDelete={handleDelete}
            isPending={isPending}
            inactive
          />
        </div>
      ) : null}

      <PartnerContactFormModal
        partnerId={partnerId}
        open={modalOpen}
        contact={editingContact}
        onClose={() => {
          setModalOpen(false);
          setEditingContact(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="담당자 삭제"
        message="정말 이 담당자를 삭제하시겠습니까? 삭제 후 목록에서 보이지 않습니다."
        confirmLabel="삭제"
        danger
        loading={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={runDelete}
      />
    </div>
  );
}

function ContactTable({
  contacts,
  onEdit,
  onDelete,
  isPending,
  inactive = false
}: {
  contacts: PartnerContact[];
  onEdit: (contact: PartnerContact) => void;
  onDelete: (contact: PartnerContact) => void;
  isPending: boolean;
  inactive?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <Th align="left">담당구분</Th>
            <Th>이름</Th>
            <Th>부서/직급</Th>
            <Th>연락처</Th>
            <Th>이메일</Th>
            <Th>계약담당</Th>
            <Th align="right">관리</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contacts.map((contact) => (
            <tr
              key={contact.id}
              className={inactive ? "bg-slate-50/80 text-slate-600" : "hover:bg-slate-50"}
            >
              <td className="px-4 py-2.5 text-sm">
                <div className="space-y-1">
                  <ContactTagsBadges tags={inferContactTags(contact)} />
                  <p className="text-xs text-slate-500">
                    {contact.role_raw ?? getContactAssignmentLabel(contact) ?? "-"}
                  </p>
                  {inactive ? (
                    <p className="text-xs text-slate-400">비활성 — 메일 발송 대상 제외</p>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-2.5 text-sm font-medium">{contact.name}</td>
              <td className="px-4 py-2.5 text-sm">
                {[contact.department, contact.position].filter(Boolean).join(" / ") || "-"}
              </td>
              <td className="px-4 py-2.5 text-sm">{contact.phone ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm">
                {contact.email ?? <span className="text-amber-700">미입력</span>}
                {(contact.previous_emails?.length ?? 0) > 0 ? (
                  <p className="mt-0.5 text-xs text-slate-400">
                    이전: {contact.previous_emails?.join(", ")}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-sm text-center">
                {contact.is_contract_contact ? "O" : "-"}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(contact)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onDelete(contact)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={[
        "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
        align === "right" ? "text-right" : "text-left"
      ].join(" ")}
    >
      {children}
    </th>
  );
}
