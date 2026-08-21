"use client";

import { useMemo, useState } from "react";
import {
  formatAdminDateTime,
  historyEventLabel,
  historyEventMessage,
  isAutosaveEvent,
  isBusinessHistoryEvent,
  type ApplicationEventRow
} from "@/lib/partner-applications/admin-display";

export function ApplicationEventLog({
  events,
  draftSavedCount = 0,
  draftEvents = []
}: {
  events: ApplicationEventRow[];
  draftSavedCount?: number;
  draftEvents?: ApplicationEventRow[];
}) {
  const [showAutosave, setShowAutosave] = useState(false);
  const business = useMemo(
    () =>
      events.filter((ev) => isBusinessHistoryEvent(String(ev.event_type ?? "")) && !isAutosaveEvent(String(ev.event_type ?? ""))),
    [events]
  );
  const autosaveCount = draftSavedCount || events.filter((ev) => isAutosaveEvent(String(ev.event_type ?? ""))).length;
  const autosaveRows = draftEvents.length
    ? draftEvents
    : events.filter((ev) => isAutosaveEvent(String(ev.event_type ?? "")));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">이력</h2>
      {business.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">표시할 업무 이력이 없습니다.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {business.map((ev, index) => {
            const type = String(ev.event_type ?? "");
            const message = historyEventMessage(ev);
            return (
              <li key={String(ev.id ?? `${type}-${index}`)} className="flex flex-col gap-0.5 border-b border-slate-50 pb-2 last:border-0">
                <span className="text-xs text-slate-500">{formatAdminDateTime(ev.created_at)}</span>
                <span className="font-medium text-slate-900">{historyEventLabel(type)}</span>
                {message ? <span className="text-xs text-slate-600">{message}</span> : null}
              </li>
            );
          })}
        </ol>
      )}
      {autosaveCount > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">자동 임시저장 {autosaveCount}회</p>
          <button
            type="button"
            className="mt-1 text-xs text-blue-700 underline"
            onClick={() => setShowAutosave((v) => !v)}
          >
            {showAutosave ? "자동저장 이력 숨기기" : "자동저장 이력 보기"}
          </button>
          {showAutosave ? (
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-slate-500">
              {autosaveRows.map((ev, index) => (
                <li key={String(ev.id ?? `draft-${index}`)}>{formatAdminDateTime(ev.created_at)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
