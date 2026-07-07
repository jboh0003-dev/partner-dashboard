"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, History } from "lucide-react";
import { POLICY_UI_CATEGORIES } from "@/lib/policy/constants";
import { isBadParseContent } from "@/lib/policy/xml-text";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "@/types/partner-policy";

type PolicyViewProps = {
  current: PartnerPolicyDocument | null;
  versions: PartnerPolicyDocument[];
  chunks: PartnerPolicyChunk[];
  fallbackMode?: boolean;
};

export function PolicyView({ current, versions, chunks, fallbackMode = false }: PolicyViewProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showVersions, setShowVersions] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredChunks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chunks.filter((chunk) => {
      if (chunk.is_active === false || chunk.parse_status === "bad_parse") return false;
      if (isBadParseContent(chunk.content)) return false;
      if (category !== "all" && chunk.category !== category) return false;
      if (!q) return true;
      const haystack = `${chunk.section_title ?? ""} ${chunk.content} ${(chunk.keywords ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [chunks, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, PartnerPolicyChunk[]>();
    for (const chunk of filteredChunks) {
      const key = chunk.category ?? "기타";
      const list = map.get(key) ?? [];
      list.push(chunk);
      map.set(key, list);
    }
    return map;
  }, [filteredChunks]);

  function toggleCategory(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!current && fallbackMode) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        업로드된 정책 버전이 없습니다.{" "}
        <Link href="/dashboard/policy/upload" className="font-semibold text-okestro-600 hover:underline">
          파트너 정책 업로드
        </Link>
        에서 PPT를 등록해 주세요.
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-okestro-600">현재 정책</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{current.policy_title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {current.version_label} · 기준일 {current.effective_date}
            </p>
            <p className="mt-1 text-xs text-slate-500">{current.source_file_name}</p>
            {current.description ? <p className="mt-2 text-sm text-slate-700">{current.description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/policy/documents/${current.id}/download`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              다운로드
            </a>
            <Link
              href="/dashboard/policy/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-okestro-600 px-3 py-2 text-sm font-semibold text-white hover:bg-okestro-700"
            >
              새 버전 업로드
            </Link>
            <button
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <History className="h-4 w-4" />
              이전 버전
            </button>
          </div>
        </div>
      </div>

      {showVersions ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">버전</th>
                <th className="px-4 py-3 text-left">기준일</th>
                <th className="px-4 py-3 text-left">업로드일</th>
                <th className="px-4 py-3 text-center">최신</th>
                <th className="px-4 py-3 text-left">메모</th>
                <th className="px-4 py-3 text-left">조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="px-4 py-2 font-medium">{version.version_label}</td>
                  <td className="px-4 py-2">{version.effective_date}</td>
                  <td className="px-4 py-2">{version.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-center">{version.is_current ? "Y" : "-"}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{version.change_memo ?? "-"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/policy?version=${version.id}`} className="text-okestro-600 hover:underline">
                        보기
                      </Link>
                      <a href={`/api/policy/documents/${version.id}/download`} className="text-slate-600 hover:underline">
                        다운로드
                      </a>
                      {!version.is_current ? (
                        <button
                          type="button"
                          className="text-amber-700 hover:underline"
                          onClick={() => void restoreVersion(version.id)}
                        >
                          최신으로 복원
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="정책 내용 검색"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">전체 카테고리</option>
          {POLICY_UI_CATEGORIES.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filteredChunks.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            최신 정책 문서는 등록되어 있으나 표시 가능한 텍스트 chunk가 없습니다.{" "}
            <Link href="/dashboard/policy/upload" className="font-semibold underline">
              정책 재업로드 또는 재처리
            </Link>
            가 필요합니다.
          </div>
        ) : null}
        {POLICY_UI_CATEGORIES.map((item) => {
          const list = grouped.get(item.key) ?? [];
          if (list.length === 0) return null;
          const isOpen = expanded.has(item.key) || query.length > 0 || category === item.key;
          return (
            <section key={item.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => toggleCategory(item.key)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{item.label}</h3>
                  <p className="text-xs text-slate-500">{list.length}개 섹션</p>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
              {isOpen ? (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {list.map((chunk) => (
                    <article key={chunk.id} className="rounded-lg bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">{chunk.section_title ?? "섹션"}</h4>
                        {chunk.slide_number ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                            슬라이드 {chunk.slide_number}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{chunk.content}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

async function restoreVersion(documentId: string) {
  const confirmed = window.confirm("이 버전을 최신 정책으로 복원하시겠습니까?");
  if (!confirmed) return;
  const response = await fetch(`/api/policy/documents/${documentId}/set-current`, { method: "POST" });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    window.alert(json.message ?? "복원 실패");
    return;
  }
  window.location.href = "/dashboard/policy";
}
