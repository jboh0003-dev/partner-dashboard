"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

export type PerformanceMatchPartnerOption = {
  id: string;
  company_name: string;
  grade_label?: string;
  external_no?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
};

type PerformanceMatchModalProps = {
  open: boolean;
  rawPartnerName: string;
  saving?: boolean;
  onClose: () => void;
  onSelect: (partner: PerformanceMatchPartnerOption, saveAlias: boolean) => void;
};

export function PerformanceMatchModal({
  open,
  rawPartnerName,
  saving = false,
  onClose,
  onSelect
}: PerformanceMatchModalProps) {
  const [query, setQuery] = useState(rawPartnerName);
  const [saveAlias, setSaveAlias] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PerformanceMatchPartnerOption[]>([]);

  useEffect(() => {
    if (open) {
      setQuery(rawPartnerName);
      setSaveAlias(Boolean(rawPartnerName.trim()));
    }
  }, [open, rawPartnerName]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/partners/search?q=${encodeURIComponent(q)}&limit=20`)
        .then((res) => res.json())
        .then((json) => {
          setResults(
            (json.partners ?? []).map((row: Record<string, unknown>) => ({
              id: String(row.id),
              company_name: String(row.company_name),
              grade_label: row.grade_label ? String(row.grade_label) : undefined,
              external_no: row.external_no ? String(row.external_no) : null,
              contact_name: row.contact_name ? String(row.contact_name) : null,
              contact_email: row.contact_email ? String(row.contact_email) : null
            }))
          );
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">파트너 매칭</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              원본 파트너명: <span className="font-semibold">{rawPartnerName || "(미기재)"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="파트너사명, 파트너번호, 담당자명, 이메일 검색"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
              autoFocus
              disabled={saving}
            />
          </div>

          {rawPartnerName.trim() ? (
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={saveAlias}
                onChange={(e) => setSaveAlias(e.target.checked)}
                disabled={saving}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                <span className="font-semibold">「{rawPartnerName}」</span>을(를) 별칭으로 저장
                <span className="mt-0.5 block text-xs text-slate-500">
                  다음 업로드부터 같은 원본명은 자동 매칭됩니다.
                </span>
              </span>
            </label>
          ) : null}

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                검색 중…
              </div>
            ) : results.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {query.trim() ? "검색 결과가 없습니다." : "검색어를 입력해 주세요."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((partner) => (
                  <li key={partner.id}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onSelect(partner, saveAlias)}
                      className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{partner.company_name}</span>
                        {partner.grade_label ? (
                          <span className="shrink-0 text-xs text-slate-500">{partner.grade_label}</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                        {partner.external_no ? <span>파트너번호 {partner.external_no}</span> : null}
                        {partner.contact_name ? <span>담당 {partner.contact_name}</span> : null}
                        {partner.contact_email ? <span>{partner.contact_email}</span> : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
