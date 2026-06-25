import type { EventTypeLabel } from "@/lib/events/event-types";

const DESCRIPTIONS: Record<EventTypeLabel, string> = {
  파트너데이:
    "파트너사를 대상으로 주요 사업 방향, 정책, 협력 전략을 공유한 행사입니다.",
  세미나: "특정 주제 또는 지역 파트너/고객을 대상으로 진행된 세미나입니다.",
  간담회:
    "주요 파트너사와 협력 현황 및 향후 추진 방향을 논의한 간담회입니다.",
  솔루션데이:
    "솔루션 및 제품 메시지를 공유하고 고객/파트너 대상 세일즈 활동을 지원하기 위한 행사입니다.",
  정책설명회: "파트너 정책 및 사업 방향을 설명하고 협력 방안을 공유한 행사입니다.",
  기타: "파트너·고객 대상으로 진행된 행사입니다."
};

export function buildEventDescription(eventType: EventTypeLabel): string {
  return DESCRIPTIONS[eventType] ?? DESCRIPTIONS.기타;
}

export function buildEventSummary(eventName: string, eventDate: string | null): string {
  const dateLabel = eventDate
    ? new Date(eventDate).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : "";
  return [dateLabel, eventName, "행사 자료"].filter(Boolean).join(" ");
}
