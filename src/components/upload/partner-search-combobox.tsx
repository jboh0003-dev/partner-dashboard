"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  filterPartnerSearchOptions,
  findPartnerOptionById,
  type PartnerSearchOption
} from "@/lib/documents/partner-search";

type PartnerSearchComboboxProps = {
  options: PartnerSearchOption[];
  value: string | null;
  onChange: (partner: PartnerSearchOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function PartnerSearchCombobox({
  options,
  value,
  onChange,
  placeholder = "파트너명 검색...",
  disabled = false,
  className
}: PartnerSearchComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = useMemo(() => findPartnerOptionById(options, value), [options, value]);

  const filtered = useMemo(
    () => filterPartnerSearchOptions(options, open ? query : selected?.company_name ?? query),
    [options, query, open, selected?.company_name]
  );

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.company_name ?? "");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [selected?.company_name]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open]);

  function selectOption(option: PartnerSearchOption | null) {
    onChange(option);
    setQuery(option?.company_name ?? "");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlightIndex];
      if (option) selectOption(option);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected?.company_name ?? "");
    }
  }

  return (
    <div ref={rootRef} className={["relative min-w-[14rem]", className ?? ""].join(" ")}>
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          value={open ? query : selected?.company_name ?? query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.company_name ?? "");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-xs outline-none focus:border-blue-600 disabled:bg-slate-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((current) => !current);
            if (!open) {
              setQuery(selected?.company_name ?? "");
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          aria-label="파트너 목록 열기"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && !disabled ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full min-w-[18rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectOption(option)}
                className={[
                  "flex w-full flex-col items-start px-3 py-2 text-left text-xs",
                  index === highlightIndex ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                ].join(" ")}
              >
                <span className="font-semibold">{option.company_name}</span>
                {option.external_no ? (
                  <span className="mt-0.5 text-[10px] text-slate-400">No. {option.external_no}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
