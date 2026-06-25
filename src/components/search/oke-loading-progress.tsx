"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { OkeAvatar } from "@/components/search/oke-avatar";
import {
  getOkeLoadingStages,
  OKE_STAGE_INTERVAL_MS,
  type OkeLoadingStage
} from "@/lib/search/loading-stages";

type OkeLoadingProgressProps = {
  query: string;
  active: boolean;
};

export function OkeLoadingProgress({ query, active }: OkeLoadingProgressProps) {
  const stages = getOkeLoadingStages(query);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex(0);
    const timer = window.setInterval(() => {
      setActiveIndex((current) => Math.min(current + 1, stages.length - 1));
    }, OKE_STAGE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [active, query, stages.length]);

  if (!active) return null;

  return (
    <div className="ui-oke-result mt-5 border-okestro-100 bg-gradient-to-br from-white to-okestro-50/40">
      <div className="flex items-center gap-3">
        <OkeAvatar size="sm" />
        <div>
          <p className="text-sm font-semibold text-slate-900">오케가 응답을 준비하고 있습니다</p>
          <p className="text-2xs text-slate-500">등록된 데이터만 조회합니다. 추측 답변은 제공하지 않습니다.</p>
        </div>
      </div>
      <ol className="mt-4 space-y-1.5">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            status={index < activeIndex ? "done" : index === activeIndex ? "active" : "pending"}
          />
        ))}
      </ol>
    </div>
  );
}

function StageRow({
  stage,
  status
}: {
  stage: OkeLoadingStage;
  status: "done" | "active" | "pending";
}) {
  return (
    <li
      className={[
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        status === "active" ? "bg-okestro-50 text-okestro-900 ring-1 ring-okestro-100" : "text-slate-600",
        status === "pending" ? "opacity-45" : ""
      ].join(" ")}
    >
      {status === "done" ? (
        <Check size={14} className="shrink-0 text-emerald-600" />
      ) : status === "active" ? (
        <Loader2 size={14} className="shrink-0 animate-spin text-okestro-600" />
      ) : (
        <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />
      )}
      <span className={status === "active" ? "font-semibold" : ""}>{stage.label}</span>
    </li>
  );
}
