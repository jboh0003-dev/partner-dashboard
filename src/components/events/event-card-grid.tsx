"use client";

import Link from "next/link";
import { CalendarDays, ExternalLink, FileText, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEventTypeLabel } from "@/lib/events/folder-parser";
import { formatDate } from "@/lib/utils";
import type { PartnerEventWithDocs } from "@/types/event";

export function EventCardGrid({ events }: { events: PartnerEventWithDocs[] }) {
  if (events.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <article
          key={event.id}
          className="ui-card flex flex-col p-5 transition hover:border-okestro-200 hover:shadow-elevated"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge tone="primary">{formatEventTypeLabel(event.event_type)}</Badge>
              <h3 className="mt-2 break-keep text-base font-semibold text-slate-950">
                {event.event_name}
              </h3>
            </div>
            <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
              {event.year ?? (event.event_date ? new Date(event.event_date).getFullYear() : "-")}
            </span>
          </div>

          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="shrink-0 text-slate-400" />
              <dd>{event.event_date ? formatDate(event.event_date) : "일자 미등록"}</dd>
            </div>
            {event.location ? (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="shrink-0 text-slate-400" />
                <dd className="break-keep">{event.location}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <FileText size={14} className="shrink-0 text-slate-400" />
              <dd>
                자료 {event.document_count}건 · 대표 {event.representative_document_count}건
              </dd>
            </div>
          </dl>

          {event.summary ? (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{event.summary}</p>
          ) : event.description ? (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{event.description}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/dashboard/events/${event.id}`} className="ui-btn-accent px-3 py-2 text-xs">
              상세 보기
              <ExternalLink size={12} />
            </Link>
            <Link
              href={`/dashboard/events/${event.id}#documents`}
              className="ui-btn-secondary px-3 py-2 text-xs"
            >
              자료 보기
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
