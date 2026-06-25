import Link from "next/link";

type TrainingTabKey = "summary" | "attendees" | "recruitment";

type TrainingTabsProps = {
  active: TrainingTabKey;
  searchParams: Record<string, string | string[] | undefined>;
};

export function TrainingTabs({ active, searchParams }: TrainingTabsProps) {
  const tabs: Array<{ key: TrainingTabKey; label: string }> = [
    { key: "summary", label: "월별 교육 요약" },
    { key: "attendees", label: "참석자 상세 목록" },
    { key: "recruitment", label: "모객 대상 추출" }
  ];

  return (
    <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map((tab) => {
        const selected = active === tab.key;
        const href = buildTabHref(tab.key, searchParams);
        return (
          <Link
            key={tab.key}
            href={href}
            className={[
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              selected
                ? "bg-slate-950 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function buildTabHref(
  tab: TrainingTabKey,
  searchParams: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();
  params.set("tab", tab);

  if (tab === "attendees") {
    appendParam(params, "q", searchParams.q);
    appendParam(params, "month", searchParams.month);
    appendParam(params, "training", searchParams.training);
  }

  if (tab === "recruitment") {
    for (const key of [
      "q",
      "audience",
      "grade",
      "contract_from",
      "contract_to",
      "contact_role",
      "new_partner_since"
    ] as const) {
      appendParam(params, key, searchParams[key]);
    }
    appendMultiParam(params, "months", searchParams.months);
    appendMultiParam(params, "attended_tags", searchParams.attended_tags);
    appendMultiParam(params, "not_attended_tags", searchParams.not_attended_tags);
  }

  const query = params.toString();
  return query ? `/dashboard/trainings?${query}` : "/dashboard/trainings";
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined
) {
  if (!value) return;
  const text = Array.isArray(value) ? value[0] : value;
  if (text) params.set(key, text);
}

function appendMultiParam(
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined
) {
  if (!value) return;
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    if (item) params.append(key, item);
  }
}
