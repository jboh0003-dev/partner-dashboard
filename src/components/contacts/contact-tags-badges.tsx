import { CONTACT_ASSIGNMENT_TONE_CLASS } from "@/lib/contacts/display";

const TAG_TONE: Record<string, keyof typeof CONTACT_ASSIGNMENT_TONE_CLASS> = {
  계약담당자: "contract",
  "대표/경영": "executive",
  영업: "sales",
  엔지니어: "engineer",
  "정기교육 참석자": "default",
  "기술파트너 교육 참석자": "default"
};

export function ContactTagsBadges({
  tags,
  className = ""
}: {
  tags: string[];
  className?: string;
}) {
  if (tags.length === 0) {
    return <span className="text-sm text-slate-500">일반 담당자</span>;
  }

  return (
    <div className={["flex flex-wrap gap-1", className].join(" ")}>
      {tags.map((tag) => {
        const tone = TAG_TONE[tag] ?? "default";
        return (
          <span
            key={tag}
            className={[
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              CONTACT_ASSIGNMENT_TONE_CLASS[tone]
            ].join(" ")}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}
