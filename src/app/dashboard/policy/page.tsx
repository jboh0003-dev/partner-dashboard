import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import {
  PARTNER_POLICY_PPT_FILENAME,
  PARTNER_POLICY_PPT_PATH,
  PARTNER_POLICY_SECTIONS,
  PARTNER_POLICY_UPDATED_AT,
  type PolicySection
} from "@/lib/policy/partner-policy";

export default function PartnerPolicyPage() {
  return (
    <>
      <PageHero
        title="파트너 정책 / 가이드"
        description="파트너 등급, 혜택, 교육, PoC, 계약 서류 기준을 한곳에서 확인합니다."
        action={
          <a
            href={PARTNER_POLICY_PPT_PATH}
            download={PARTNER_POLICY_PPT_FILENAME}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
          >
            <Download size={16} />
            원본 PPT 다운로드
          </a>
        }
      />

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <FileText size={16} className="text-blue-600" />
        <span>
          기준 문서: <strong className="text-slate-900">{PARTNER_POLICY_PPT_FILENAME}</strong>
        </span>
        <span className="text-slate-400">·</span>
        <span>업데이트: {PARTNER_POLICY_UPDATED_AT}</span>
      </div>

      <div className="space-y-6">
        {PARTNER_POLICY_SECTIONS.map((section) => (
          <PolicySectionCard key={section.id} section={section} />
        ))}
      </div>
    </>
  );
}

function PolicySectionCard({ section }: { section: PolicySection }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-950">{section.title}</h2>
        {section.description ? (
          <p className="mt-1 text-sm text-slate-500">{section.description}</p>
        ) : null}
      </div>

      <div className="p-6">
        {section.rows && section.columns ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {section.columns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    {section.columns!.map((column) => (
                      <td key={column} className="px-4 py-3 text-sm text-slate-700">
                        {row[column] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {section.bullets ? (
          <ul className="space-y-2">
            {section.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex gap-2 text-sm leading-relaxed text-slate-700"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
