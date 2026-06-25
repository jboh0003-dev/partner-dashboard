import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, Sparkles } from "lucide-react";
import { EventDetailView } from "@/components/events/event-detail-view";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { formatEventTypeLabel } from "@/lib/events/folder-parser";
import { fetchPartnerEventById } from "@/lib/data/partner-events";
import { fetchEventPartnerLinks } from "@/lib/data/event-partners";
import { formatDate } from "@/lib/utils";
import { EventPartnersPanel } from "@/components/events/event-partners-panel";

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, error } = await fetchPartnerEventById(id);
  const { links: partnerLinks } = await fetchEventPartnerLinks(id);

  if (error) {
    return (
      <EmptyState title="행사 정보를 불러오지 못했습니다." description={error} />
    );
  }

  if (!event) notFound();

  const okeSummary =
    event.summary?.trim() ||
    [event.event_name, event.event_type, event.event_date ? formatDate(event.event_date) : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/events"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          행사 현황으로
        </Link>
      </div>

      <PageHeader
        title={event.event_name}
        description={formatEventTypeLabel(event.event_type)}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">행사 개요</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">연도</dt>
              <dd className="mt-1 font-semibold text-slate-900">{event.year ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">일자</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {event.event_date ? formatDate(event.event_date) : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">유형</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatEventTypeLabel(event.event_type)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">장소</dt>
              <dd className="mt-1 font-semibold text-slate-900">{event.location ?? "-"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">원본 폴더</dt>
              <dd className="mt-1 break-all text-slate-800">{event.source_folder_name ?? "-"}</dd>
            </div>
          </dl>

          {event.description ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900">행사 설명</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{event.description}</p>
            </div>
          ) : null}

          {event.related_partners ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900">관련 파트너</h3>
              <p className="mt-2 text-sm text-slate-700">{event.related_partners}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-700" />
            <h2 className="text-sm font-semibold text-slate-900">오케 요약</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{okeSummary}</p>
          <p className="mt-4 text-xs text-slate-500">
            등록된 행사 DB 기준 요약입니다. 자료 {event.document_count}건이 연결되어 있습니다.
          </p>
        </section>
      </div>

      <EventPartnersPanel eventId={event.id} initialLinks={partnerLinks} />

      <EventDetailView
        eventId={event.id}
        publicDocuments={event.documents}
        allDocuments={event.all_documents}
      />

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">메모 / 히스토리</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {event.summary ?? "등록된 행사 메모가 없습니다. 행사 요약 또는 설명 필드를 참고해 주세요."}
        </p>
      </section>
    </>
  );
}
