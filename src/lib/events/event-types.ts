export const EVENT_TYPE_LABELS = {
  파트너데이: "파트너데이",
  세미나: "세미나",
  간담회: "간담회",
  솔루션데이: "솔루션데이",
  정책설명회: "정책설명회",
  기타: "기타"
} as const;

export type EventTypeLabel = keyof typeof EVENT_TYPE_LABELS;

export const EVENT_TYPE_FILTER_OPTIONS: EventTypeLabel[] = [
  "파트너데이",
  "세미나",
  "간담회",
  "솔루션데이",
  "정책설명회",
  "기타"
];
