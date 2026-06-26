"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Search,
  Server,
  Sparkles,
  Users
} from "lucide-react";
import { downloadPartnerDocumentFile } from "@/components/documents/document-row-actions";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import { runPartnerSearch } from "@/app/dashboard/search/actions";
import { OkeAvatar } from "@/components/search/oke-avatar";
import { OkeLoadingProgress } from "@/components/search/oke-loading-progress";
import {
  EXAMPLE_QUESTIONS,
  OKE_GREETING,
  OKE_NAME,
  OKE_SUBTITLE,
  PAGE_EXAMPLE_QUESTIONS
} from "@/components/search/search-examples";
import { getSearchIntentLabel } from "@/lib/search/intent-labels";
import {
  OKE_EVENT_LABEL,
  OKE_POLICY_LABEL,
  OKE_RESULT_LABEL
} from "@/lib/search/oke-branding";
import type { SearchListResult, SearchResult } from "@/lib/search/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: SearchResult;
};

const CAPABILITY_CARDS = [
  {
    icon: Sparkles,
    title: "정책·가이드",
    description: "등급·승급 기준, 계약·교육 운영 정책, FAQ 안내"
  },
  {
    icon: Server,
    title: "장비·문서",
    description: "파트너별 장비·문서 등록 현황 및 조건 검색"
  },
  {
    icon: Users,
    title: "담당자·교육",
    description: "담당자 연락처, 교육 참석·미수강 파트너 조회"
  },
  {
    icon: BookOpen,
    title: "행사·기간",
    description: "행사 자료, 계약월·등급·장비 보유 등 복합 조건 검색"
  }
];

type SearchChatProps = {
  variant?: "page" | "panel";
};

export function SearchChat({ variant = "page" }: SearchChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [examplesExpanded, setExamplesExpanded] = useState(true);
  const [pendingQuery, setPendingQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const isPanel = variant === "panel";
  const hasResults = messages.some((message) => message.role === "assistant");

  useEffect(() => {
    if (isPanel && hasResults) {
      setExamplesExpanded(false);
    }
  }, [isPanel, hasResults]);

  function submitQuery(query: string) {
    const trimmed = query.trim();
    if (!trimmed || isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPendingQuery(trimmed);

    startTransition(async () => {
      const result = await runPartnerSearch(trimmed);
      setPendingQuery("");
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.answer,
          result
        }
      ]);
    });
  }

  return (
    <div
      className={[
        "flex min-h-0 flex-col bg-slate-50",
        isPanel ? "h-full" : "min-h-[640px] ui-card overflow-hidden"
      ].join(" ")}
    >
      {!isPanel ? (
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-white via-okestro-50/40 to-white px-6 py-5">
          <div className="flex items-start gap-4">
            <OkeAvatar size="md" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-950">{OKE_NAME}</h2>
                <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">
                  AI
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-blue-900/80">{OKE_SUBTITLE}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{OKE_GREETING}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {!hasResults && !isPanel ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CAPABILITY_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="ui-card p-4"
                >
                  <card.icon size={18} className="text-okestro-600" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">{card.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.description}</p>
                </div>
              ))}
            </div>

            <div className="ui-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                오케에게 물어보기
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {PAGE_EXAMPLE_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => submitQuery(question)}
                    disabled={isPending}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm leading-snug text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {!hasResults && isPanel ? (
          <div className="ui-oke-result flex items-start gap-3 border-okestro-100 bg-gradient-to-br from-white to-okestro-50/50 p-4">
            <OkeAvatar size="sm" />
            <p className="text-sm leading-relaxed text-slate-700">{OKE_GREETING}</p>
          </div>
        ) : null}

        <div className="space-y-5">
          {messages.map((message) => (
            <div key={message.id} className="w-full">
              {message.role === "user" ? (
                <div
                  className={
                    isPanel
                      ? "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                      : "flex justify-end"
                  }
                >
                  <div
                    className={
                      isPanel
                        ? "break-words text-sm font-medium text-slate-800"
                        : "max-w-[85%] rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white"
                    }
                  >
                    <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      질문
                    </span>
                    {message.content}
                  </div>
                </div>
              ) : (
                <SearchResultPanel
                  answer={message.content}
                  result={message.result!}
                  onSelectQuery={submitQuery}
                />
              )}
            </div>
          ))}
        </div>

        {isPending ? <OkeLoadingProgress query={pendingQuery} active /> : null}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-4 md:px-6">
        {isPanel ? (
          <div className="mb-4">
            {examplesExpanded ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
                  <p className="text-xs font-semibold text-slate-600">예시 질문</p>
                  <button
                    type="button"
                    onClick={() => setExamplesExpanded(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    <ChevronUp size={14} />
                    예시 질문 접기
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto p-3">
                  <div className="flex flex-col gap-2">
                    {EXAMPLE_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => submitQuery(question)}
                        disabled={isPending}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs leading-snug text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExamplesExpanded(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ChevronDown size={14} />
                예시 질문 보기
              </button>
            )}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitQuery(input);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="오케에게 파트너·정책·조건 검색을 요청해 주세요."
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-600"
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-blue-900 px-5 py-3 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-blue-800 disabled:opacity-50"
          >
            <Sparkles size={14} />
            검색
          </button>
        </form>
      </div>
    </div>
  );
}

function SearchResultPanel({
  answer,
  result,
  onSelectQuery
}: {
  answer: string;
  result: SearchResult;
  onSelectQuery: (query: string) => void;
}) {
  const isExplanation =
    result.explanationStyle ||
    result.intent === "policy_lookup" ||
    result.intent === "general_knowledge_lookup";
  const isEvent = result.intent === "event_lookup";
  const resultLabel = isEvent
    ? OKE_EVENT_LABEL
    : isExplanation
      ? OKE_POLICY_LABEL
      : OKE_RESULT_LABEL;

  return (
    <div className="w-full space-y-4">
      <div
        className={[
          "ui-oke-result w-full p-5",
          isExplanation
            ? "border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40"
            : isEvent
              ? "border-violet-100 bg-gradient-to-br from-white to-violet-50/40"
              : ""
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <OkeAvatar size="sm" />
          <p className="text-2xs font-semibold uppercase tracking-wider text-okestro-700">
            {resultLabel}
          </p>
        </div>
        <p className="mt-3 break-words text-base font-semibold leading-relaxed text-slate-900">
          {answer}
        </p>

        {result.criteria ? (
          <p className="mt-2 text-sm text-slate-600">조회 기준: {result.criteria}</p>
        ) : null}

        <p className="mt-2 text-xs font-medium text-slate-500">
          조회 유형: {getSearchIntentLabel(result.intent)}
        </p>

        {result.summaryCards && result.summaryCards.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.summaryCards.map((card) => (
              <div
                key={`${card.label}-${card.value}`}
                className={[
                  "rounded-xl border px-4 py-3",
                  isExplanation
                    ? "border-indigo-100 bg-white/80"
                    : "border-slate-100 bg-slate-50"
                ].join(" ")}
              >
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {result.needsClarification && result.followUpQueries?.length ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">파트너사 선택</p>
            <p className="mt-1 text-xs text-amber-800">
              아래 후보 중 조회 대상 파트너사를 선택해 주세요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.followUpQueries.map((entry) => (
                <button
                  key={entry.query}
                  type="button"
                  onClick={() => onSelectQuery(entry.query)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {result.intent === "contact_lookup" && result.contacts.length > 0 ? (
          <ContactLookupPreview result={result} />
        ) : null}

        {result.menuLinks && result.menuLinks.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {result.menuLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                {link.label}
                <ExternalLink size={12} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {result.listResult ? (
        <SearchListTable list={result.listResult} />
      ) : null}

      {result.contacts.length > 0 && result.intent !== "contact_lookup" ? (
        <div className="ui-card w-full p-5">
          <p className="mb-3 text-sm font-semibold text-slate-900">담당자 상세</p>
          <div className="space-y-3">
            {result.contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"
              >
                <div className="break-words font-semibold text-slate-900">
                  {contact.name}
                  <span
                    className="ml-2 text-xs font-normal text-slate-500"
                    title={contact.partnerName}
                  >
                    {contact.partnerName}
                  </span>
                </div>
                <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  {contact.position ? (
                    <>
                      <dt className="text-slate-500">직급</dt>
                      <dd className="break-words">{contact.position}</dd>
                    </>
                  ) : null}
                  {contact.role ? (
                    <>
                      <dt className="text-slate-500">역할</dt>
                      <dd className="break-words">{contact.role}</dd>
                    </>
                  ) : null}
                  {contact.phone ? (
                    <>
                      <dt className="text-slate-500">연락처</dt>
                      <dd className="break-words">{contact.phone}</dd>
                    </>
                  ) : null}
                  {contact.email ? (
                    <>
                      <dt className="text-slate-500">이메일</dt>
                      <dd className="flex flex-wrap items-center gap-2 break-all">
                        {contact.email}
                        <CopyEmailButton email={contact.email} />
                      </dd>
                    </>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.items.length > 0 && !result.listResult ? (
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            {isExplanation ? "관련 정책·가이드" : isEvent ? "행사 자료" : "상세 정보"}
          </p>
          <div className="space-y-3">
            {result.items.map((item) => (
              <div
                key={item.id}
                className={[
                  "rounded-xl border p-4 text-sm",
                  item.kind === "policy" || item.kind === "guide"
                    ? "border-indigo-100 bg-indigo-50/40"
                    : item.kind === "event"
                      ? "border-violet-100 bg-violet-50/40"
                      : item.kind === "note"
                      ? "border-amber-100 bg-amber-50/40"
                      : "border-slate-100 bg-slate-50"
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start gap-2">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="break-words font-semibold text-blue-700 hover:underline"
                      title={item.title}
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <div className="break-words font-semibold text-slate-900" title={item.title}>
                      {item.title}
                    </div>
                  )}
                  {item.downloadHref ? <DocumentDownloadButton documentId={item.id} /> : null}
                </div>
                {item.subtitle ? (
                  <p
                    className="mt-2 break-words text-xs leading-relaxed text-slate-600"
                    title={item.subtitle}
                  >
                    {item.subtitle}
                  </p>
                ) : null}
                {item.meta ? (
                  <p className="mt-1 break-words text-xs text-slate-500" title={item.meta}>
                    {item.meta}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.partners.length > 1 && !result.followUpQueries?.length ? (
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">관련 파트너</p>
          <div className="flex flex-wrap gap-2">
            {result.partners.map((partner) => (
              <Link
                key={partner.id}
                href={partner.href}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
                title={partner.name}
              >
                {partner.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchListTable({ list }: { list: SearchListResult }) {
  const exportRows = list.rows.map((row) => {
    const record: Record<string, string> = {};
    for (const column of list.columns) {
      if (column.key === "detail") continue;
      record[column.label] = row.values[column.key] ?? "";
    }
    return record;
  });

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{list.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            조회 기준: {list.criteria} · 총 {list.totalCount.toLocaleString("ko-KR")}건
          </p>
        </div>
        <CsvDownloadButton rows={exportRows} filenamePrefix={list.exportFilename} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {list.columns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={list.columns.length}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  조건에 맞는 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              list.rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  {list.columns.map((column) => (
                    <td key={`${row.id}-${column.key}`} className="px-4 py-3 text-slate-700">
                      {column.key === "detail" && row.href ? (
                        <Link
                          href={row.href}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {row.values[column.key] ?? "상세 보기"}
                        </Link>
                      ) : column.key === "company" && row.href ? (
                        <Link
                          href={row.href}
                          className="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                        >
                          {row.values[column.key] ?? "-"}
                        </Link>
                      ) : (
                        <span className="break-words">{row.values[column.key] ?? "-"}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactLookupPreview({ result }: { result: SearchResult }) {
  const partnerId = result.partnerId ?? result.matchedPartner?.id ?? null;
  const partnerName = result.matchedPartner?.name ?? "파트너";
  const previewContacts = result.contacts.slice(0, 3);
  const hasMore = result.contacts.length > 3;
  const contactsHref = partnerId
    ? `/dashboard/contacts?partnerId=${partnerId}`
    : "/dashboard/contacts";

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">등록 담당자 {result.contacts.length}명</p>
        {hasMore ? (
          <Link
            href={contactsHref}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            전체 담당자 보기
          </Link>
        ) : null}
      </div>
      <div className="mt-3 space-y-3">
        {previewContacts.map((contact) => (
          <div
            key={contact.id}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            <p className="break-words font-semibold text-slate-900">{contact.name}</p>
            <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              {contact.position ? (
                <>
                  <dt className="text-slate-500">직급</dt>
                  <dd className="break-words">{contact.position}</dd>
                </>
              ) : null}
              {contact.phone ? (
                <>
                  <dt className="text-slate-500">연락처</dt>
                  <dd className="break-words">{contact.phone}</dd>
                </>
              ) : null}
              {contact.email ? (
                <>
                  <dt className="text-slate-500">이메일</dt>
                  <dd className="flex flex-wrap items-center gap-2 break-all">
                    {contact.email}
                    <CopyEmailButton email={contact.email} />
                  </dd>
                </>
              ) : null}
            </dl>
          </div>
        ))}
      </div>
      {hasMore ? (
        <Link
          href={contactsHref}
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
        >
          {partnerName} 전체 담당자 보기 ({result.contacts.length}명)
          <ExternalLink size={12} />
        </Link>
      ) : null}
    </div>
  );
}

function DocumentDownloadButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          await downloadPartnerDocumentFile(documentId, "document");
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "다운로드에 실패했습니다.");
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
    >
      <Download size={12} />
      {loading ? "준비 중..." : "다운로드"}
    </button>
  );
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700"
    >
      <Copy size={12} />
      {copied ? "복사됨" : "복사"}
    </button>
  );
}
