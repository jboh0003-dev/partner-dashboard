import Link from "next/link";
import { FileSpreadsheet, GraduationCap, TrendingUp, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const uploadMenus = [
  {
    href: "/dashboard/upload",
    title: "파트너 데이터 업로드",
    description: "파트너 기본정보, 인력/담당자, 교육, 장비, 문서, 신청서 데이터를 한 곳에서 업로드합니다.",
    icon: Upload
  },
  {
    href: "/dashboard/performance/upload",
    title: "실적/파이프라인 업로드",
    description: "파트너 실적 및 파이프라인 자료를 업로드합니다.",
    icon: TrendingUp
  },
  {
    href: "/dashboard/trainings/tech-partner-upload",
    title: "기술파트너 교육 업로드",
    description: "기술파트너 교육 데이터를 업로드하고 교육 현황에 반영합니다.",
    icon: GraduationCap
  }
] as const;

export default function UploadHubPage() {
  return (
    <>
      <PageHeader
        title="데이터 업로드"
        description="업로드 업무를 한 곳에서 선택해 진행합니다."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {uploadMenus.map((menu) => {
          const Icon = menu.icon;
          return (
            <Link
              key={menu.href}
              href={menu.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-100">
                  <Icon size={21} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-950">{menu.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{menu.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                    업로드 화면 열기
                    <FileSpreadsheet size={13} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
