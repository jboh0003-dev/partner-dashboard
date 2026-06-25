export const TRAINING_TYPES = [
  "정기교육",
  "상위등급교육",
  "제품교육",
  "심화교육",
  "기타교육"
] as const;

export type TrainingTypeLabel = (typeof TRAINING_TYPES)[number];

const TRAINING_TYPE_ALIASES: Record<string, TrainingTypeLabel> = {
  정기: "정기교육",
  정기교육: "정기교육",
  regular: "정기교육",
  상위등급: "상위등급교육",
  상위등급교육: "상위등급교육",
  premium: "상위등급교육",
  제품: "제품교육",
  제품교육: "제품교육",
  product: "제품교육",
  심화: "심화교육",
  심화교육: "심화교육",
  advanced: "심화교육",
  기타: "기타교육",
  기타교육: "기타교육",
  other: "기타교육",
  etc: "기타교육"
};

function compactTrainingType(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function normalizeTrainingType(
  value: string | null | undefined,
  fallback: TrainingTypeLabel = "정기교육"
): TrainingTypeLabel {
  if (!value?.trim()) return fallback;
  const compact = compactTrainingType(value);
  if (TRAINING_TYPE_ALIASES[compact]) return TRAINING_TYPE_ALIASES[compact];
  const lower = compact.toLowerCase();
  if (TRAINING_TYPE_ALIASES[lower]) return TRAINING_TYPE_ALIASES[lower];
  const matched = TRAINING_TYPES.find((type) => compactTrainingType(type) === compact);
  return matched ?? fallback;
}

export function formatTrainingTypeLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "-";
  return normalizeTrainingType(value, "기타교육");
}
