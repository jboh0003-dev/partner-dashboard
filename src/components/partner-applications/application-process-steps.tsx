import { resolveApplicationDisplayStatus } from "@/lib/partner-applications/status-display";
import type { PreReviewResult } from "@/lib/partner-applications/pre-review";

const STEPS = ["신청 접수", "AI 사전검토", "보완/관리자 검토", "승인/반려", "파트너 등록"];

function currentStepIndex(dbStatus: string, preReview: PreReviewResult | null): number {
  if (dbStatus === "approved" || dbStatus === "contracted") return 4;
  if (dbStatus === "rejected") return 3;
  const display = resolveApplicationDisplayStatus({ dbStatus, preReview });
  if (display === "draft" || display === "received") return 0;
  if (display === "ai_reviewing") return 1;
  if (display === "needs_revision" || display === "admin_review") return 2;
  return 0;
}

export function ApplicationProcessSteps({
  dbStatus,
  preReview
}: {
  dbStatus: string;
  preReview: PreReviewResult | null;
}) {
  const current = currentStepIndex(dbStatus, preReview);
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">진행 단계</h2>
      <ol className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-5">
        {STEPS.map((label, index) => {
          const active = index === current;
          const done = index < current;
          return (
            <li
              key={label}
              className={[
                "rounded-lg px-2 py-2 text-center",
                active ? "bg-white font-semibold text-slate-900 ring-1 ring-slate-200" : "",
                done ? "text-slate-500" : "text-slate-400"
              ].join(" ")}
            >
              <span className="block text-[10px] font-medium text-slate-400">{index + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
