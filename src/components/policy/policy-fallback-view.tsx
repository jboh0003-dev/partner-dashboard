import Link from "next/link";
import type { PolicySection } from "@/lib/policy/partner-policy";

export function PolicyFallbackView({
  sections,
  fileName,
  updatedAt
}: {
  sections: PolicySection[];
  fileName: string;
  updatedAt: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        DB에 업로드된 정책 버전이 없어 내장 정책 요약을 표시합니다.{" "}
        <Link href="/dashboard/policy/upload" className="font-semibold underline">
          파트너 정책 업로드
        </Link>
        에서 최신 PPT를 등록해 주세요.
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>
          기준 문서: <strong className="text-slate-900">{fileName}</strong>
        </span>
        <span className="text-slate-400">·</span>
        <span>업데이트: {updatedAt}</span>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-950">{section.title}</h2>
              {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
            </div>
            <div className="p-6">
              {section.bullets ? (
                <ul className="space-y-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="text-sm text-slate-700">
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
