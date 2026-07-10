"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { PersonContactRow } from "@/lib/contacts/person-groups";
import { ContactRoleBadges } from "@/components/contacts/contact-role-badges";
import { collectDisplayRoleLabels } from "@/lib/contacts/role-labels";
import { isEmailSendable } from "@/lib/contacts/email-deliverability";

type ContactPersonDetailModalProps = {
  contact: PersonContactRow | null;
  onClose: () => void;
};

type DetailEmail = {
  email: string;
  is_primary: boolean;
  is_bounced: boolean;
  is_sendable: boolean;
};

type DetailPhone = {
  phone: string;
  is_primary: boolean;
  needs_review?: boolean;
};

type TrainingHistoryItem = {
  id: string;
  training_name: string | null;
  training_date: string | null;
  attendance_status: string | null;
};

export function ContactPersonDetailModal({ contact, onClose }: ContactPersonDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<DetailEmail[]>([]);
  const [phones, setPhones] = useState<DetailPhone[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistoryItem[]>([]);
  const [memo, setMemo] = useState<string | null>(null);

  useEffect(() => {
    if (!contact?.id) return;

    let cancelled = false;
    setLoading(true);

    void fetch(`/api/contacts/${contact.id}`)
      .then((response) => response.json())
      .then(
        (json: {
          ok?: boolean;
          emails?: DetailEmail[];
          phones?: Array<{ phone: string; is_primary: boolean; needs_review?: boolean }>;
          roles?: Array<{ role_name: string }>;
          training_history?: TrainingHistoryItem[];
          contact?: { memo?: string | null };
        }) => {
          if (cancelled || !json.ok) return;
          setEmails(json.emails ?? contact.all_email_entries);
          setPhones(
            (json.phones ?? []).map((row) => ({
              phone: row.phone,
              is_primary: row.is_primary,
              needs_review: row.needs_review
            }))
          );
          setRoles((json.roles ?? []).map((row) => row.role_name));
          setTrainingHistory(json.training_history ?? []);
          setMemo(json.contact?.memo ?? contact.memo ?? null);
        }
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contact]);

  if (!contact) return null;

  const allDisplayRoles = collectDisplayRoleLabels(
    roles.length > 0 ? roles : contact.role_labels
  );
  const displayPhones =
    phones.length > 0
      ? phones
      : contact.all_phones.map((phone) => ({
          phone: phone.display,
          is_primary: phone.display === contact.display_phone,
          needs_review: phone.needs_review
        }));
  const displayEmails = emails.length > 0 ? emails : contact.all_email_entries;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{contact.name}</h2>
            <p className="text-sm text-slate-500">{contact.company_name}</p>
            {contact.review_required ? (
              <p className="mt-1 text-xs font-medium text-amber-700">검토 필요</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        {loading ? <p className="mb-3 text-xs text-slate-500">상세 정보 불러오는 중...</p> : null}

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            담당구분
          </h3>
          {allDisplayRoles.length === 0 ? (
            <span className="text-sm text-slate-400">-</span>
          ) : (
            <ContactRoleBadges labels={roles.length > 0 ? roles : contact.role_labels} maxVisible={20} />
          )}
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            이메일
          </h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {displayEmails.length === 0 ? (
              <li className="text-slate-400">미입력</li>
            ) : (
              displayEmails.map((entry) => (
                <li key={entry.email} className="flex flex-wrap items-center gap-2">
                  <span>{entry.email}</span>
                  {entry.is_primary || entry.email === contact.email?.toLowerCase() ? (
                    <span className="text-xs text-blue-600">대표</span>
                  ) : null}
                  {entry.is_bounced ? (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      반송
                    </span>
                  ) : null}
                  {!isEmailSendable(entry) ? (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      발송불가
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            연락처
          </h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {displayPhones.length === 0 ? (
              <li className="text-slate-400">미입력</li>
            ) : (
              displayPhones.map((phone) => (
                <li key={phone.phone} className="flex items-center gap-2">
                  <span>{phone.phone}</span>
                  {phone.is_primary ? <span className="text-xs text-blue-600">대표</span> : null}
                  {phone.needs_review ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertTriangle size={12} />
                      확인 필요
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        {trainingHistory.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              교육/행사 이력
            </h3>
            <ul className="space-y-1 text-sm text-slate-700">
              {trainingHistory.map((item) => (
                <li key={item.id}>
                  {item.training_name ?? "교육"} · {item.training_date ?? "-"}
                  {item.attendance_status ? ` (${item.attendance_status})` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {memo ? (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">메모</h3>
            <p className="text-sm text-slate-700">{memo}</p>
          </section>
        ) : null}

        {contact.member_ids.length > 1 ? (
          <p className="text-xs text-slate-400">
            병합 전 원본 row {contact.member_ids.length}건 (대표 id: {contact.id})
          </p>
        ) : null}
      </div>
    </div>
  );
}
