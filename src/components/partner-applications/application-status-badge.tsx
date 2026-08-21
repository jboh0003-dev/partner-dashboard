import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  APPLICATION_DISPLAY_STATUS_LABEL,
  displayStatusTone,
  resolveApplicationDisplayStatus,
  type ApplicationDisplayStatus
} from "@/lib/partner-applications/status-display";
import type { PreReviewResult } from "@/lib/partner-applications/pre-review";

export function ApplicationStatusBadge({
  dbStatus,
  preReview,
  showAiMark = false
}: {
  dbStatus: string;
  preReview?: Pick<PreReviewResult, "status" | "overall"> | null;
  showAiMark?: boolean;
}) {
  const display: ApplicationDisplayStatus = resolveApplicationDisplayStatus({
    dbStatus,
    preReview
  });
  const aiDone = preReview?.status === "completed";

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={displayStatusTone(display)}>{APPLICATION_DISPLAY_STATUS_LABEL[display]}</Badge>
      {showAiMark && aiDone ? (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200"
          title="AI 검토 완료"
        >
          <Sparkles size={10} />
          AI
        </span>
      ) : null}
    </span>
  );
}
