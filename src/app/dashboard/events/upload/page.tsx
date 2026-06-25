import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EventCurationUploadSection } from "@/components/events/event-curation-upload-section";

export default function EventUploadPage() {
  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/events"
          className="text-sm font-semibold text-slate-600 hover:text-blue-700"
        >
          ← 행사 현황으로
        </Link>
      </div>
      <PageHeader
        title="행사 자료 업로드"
        description="행사 폴더를 선택하면 전체 파일이 Storage에 저장됩니다. 대표·일반 자료만 일반 화면에 표시되며, 작업본·구버전·내부자료는 관리 화면에서 확인할 수 있습니다."
      />
      <EventCurationUploadSection />
    </>
  );
}
