"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import {
  EVENT_PARTNER_RELATION_TYPES,
  type EventPartnerLinkWithPartner
} from "@/lib/events/event-partner-types";

type PartnerOption = {
  id: string;
  company_name: string;
  grade: string | null;
};

export function EventPartnersPanel({
  eventId,
  initialLinks
}: {
  eventId: string;
  initialLinks: EventPartnerLinkWithPartner[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PartnerOption[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [relationType, setRelationType] = useState<string>("관련");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPartner = useMemo(
    () => options.find((option) => option.id === selectedPartnerId) ?? null,
    [options, selectedPartnerId]
  );

  async function searchPartners(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setOptions([]);
      return;
    }

    const response = await fetch(`/api/partners/search?q=${encodeURIComponent(value.trim())}`);
    const data = await response.json();
    setOptions((data.partners ?? []) as PartnerOption[]);
  }

  async function handleAddPartner() {
    if (!selectedPartnerId) {
      setError("파트너를 선택해 주세요.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/events/${eventId}/partners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: selectedPartnerId,
          relationType
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "연결 저장에 실패했습니다.");
        return;
      }

      const nextLink = data.link as EventPartnerLinkWithPartner;
      setLinks((current) => {
        const filtered = current.filter((item) => item.id !== nextLink.id);
        return [nextLink, ...filtered];
      });
      setSelectedPartnerId("");
      setQuery("");
      setOptions([]);
    });
  }

  async function handleRemove(linkId: string) {
    if (!window.confirm("파트너 연결을 해제할까요?")) return;

    startTransition(async () => {
      const response = await fetch(
        `/api/events/${eventId}/partners?linkId=${encodeURIComponent(linkId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "연결 해제에 실패했습니다.");
        return;
      }
      setLinks((current) => current.filter((item) => item.id !== linkId));
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900">관련 파트너</h2>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        수동으로 연결한 파트너는 파트너 상세 &gt; 행사 이력 탭에 표시됩니다.
      </p>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div>
          <label className="text-xs font-semibold text-slate-600">파트너 검색</label>
          <input
            value={query}
            onChange={(event) => searchPartners(event.target.value)}
            placeholder="파트너사명 검색"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {options.length > 0 ? (
            <select
              value={selectedPartnerId}
              onChange={(event) => setSelectedPartnerId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">파트너 선택</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.company_name}
                  {option.grade ? ` (${option.grade})` : ""}
                </option>
              ))}
            </select>
          ) : null}
          {selectedPartner ? (
            <p className="mt-2 text-xs text-slate-600">
              선택: {selectedPartner.company_name}
              {selectedPartner.grade ? ` · ${selectedPartner.grade}` : ""}
            </p>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">관계유형</label>
          <select
            value={relationType}
            onChange={(event) => setRelationType(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {EVENT_PARTNER_RELATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleAddPartner}
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            연결 저장
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {links.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">연결된 파트너가 없습니다.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">파트너사</th>
                <th className="px-4 py-2 text-left">등급</th>
                <th className="px-4 py-2 text-left">관계유형</th>
                <th className="px-4 py-2 text-left">출처</th>
                <th className="px-4 py-2 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {link.partner.company_name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{link.partner.grade ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{link.relation_type}</td>
                  <td className="px-4 py-2.5 text-slate-500">{link.source}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/dashboard/partners/${link.partner_id}`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                      >
                        파트너 상세
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemove(link.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                        연결 해제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
