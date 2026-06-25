export const COURSE_TAGS = [
  "CONTRABASS",
  "VIOLA",
  "CMP",
  "TROMBONE",
  "CI/CD",
  "기타"
] as const;

export type CourseTag = (typeof COURSE_TAGS)[number];

const KNOWN_TAGS: Array<{ tag: CourseTag; patterns: string[] }> = [
  { tag: "CONTRABASS", patterns: ["CONTRABASS"] },
  { tag: "VIOLA", patterns: ["VIOLA"] },
  { tag: "CMP", patterns: ["CMP"] },
  { tag: "TROMBONE", patterns: ["TROMBONE"] },
  { tag: "CI/CD", patterns: ["CI/CD", "CICD", "CI CD"] }
];

export function normalizeTrainingNameKey(trainingName: string): string {
  return trainingName.trim().toUpperCase().replace(/\s+/g, "");
}

export function extractCourseTags(trainingName: string | null | undefined): CourseTag[] {
  if (!trainingName?.trim()) return ["기타"];

  const compact = normalizeTrainingNameKey(trainingName);
  const tags = new Set<CourseTag>();

  for (const entry of KNOWN_TAGS) {
    if (entry.patterns.some((pattern) => compact.includes(pattern.replace(/\s+/g, "")))) {
      tags.add(entry.tag);
    }
  }

  if (tags.size === 0) tags.add("기타");
  return Array.from(tags);
}

export function formatCourseTags(tags: Iterable<CourseTag>): string {
  const list = Array.from(new Set(tags));
  if (list.length === 0) return "-";
  return list.join(", ");
}

export function getNotAttendedCourseTags(attended: Set<CourseTag>): CourseTag[] {
  return COURSE_TAGS.filter((tag) => tag !== "기타" && !attended.has(tag));
}

export function parseCourseTagsParam(
  value: string | string[] | undefined
): CourseTag[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(",");
  const allowed = new Set<string>(COURSE_TAGS);
  return raw
    .map((item) => item.trim())
    .filter((item): item is CourseTag => allowed.has(item));
}
