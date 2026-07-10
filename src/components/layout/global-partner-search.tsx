"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { GlobalPartnerSearchResult } from "@/lib/partners/global-search";

const DEBOUNCE_MS = 250;

export function GlobalPartnerSearch() {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalPartnerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/partners/search?q=${encodeURIComponent(trimmed)}&limit=10`
          );
          const json = (await response.json()) as { partners?: GlobalPartnerSearchResult[] };
          setResults(json.partners ?? []);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function navigateToPartner(partnerId: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/dashboard/partners/${partnerId}`);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (results.length > 0) {
      navigateToPartner(results[0]!.id);
      return;
    }
    setOpen(true);
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative mt-4">
      <form onSubmit={handleSubmit}>
        <label htmlFor="global-partner-search" className="sr-only">
          파트너 검색
        </label>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="global-partner-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="파트너 검색"
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-okestro-500 focus:bg-white focus:ring-2 focus:ring-okestro-100"
          />
        </div>
      </form>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {loading ? (
            <p className="px-3 py-2.5 text-xs text-slate-500">검색 중...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-500">검색 결과 없음</p>
          ) : (
            results.map((partner) => (
              <button
                key={partner.id}
                type="button"
                role="option"
                onClick={() => navigateToPartner(partner.id)}
                className="block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{partner.company_name}</span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500">
                    {partner.grade_label}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {partner.external_no ? `No. ${partner.external_no}` : "번호 없음"}
                  {partner.contact_name ? ` · ${partner.contact_name}` : ""}
                </div>
                {partner.contact_email ? (
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">{partner.contact_email}</div>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
