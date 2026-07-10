import { DocumentsListTable } from "@/components/documents/documents-list-table";
import { DocumentsToolbar } from "@/components/documents/documents-toolbar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import {
  getDocumentDisplayFileName,
  getDocumentTypeShortLabel,
  getMatchStatusLabel,
  getPublicDocumentStatusLabel,
  resolveMatchStatus
} from "@/lib/documents/display";
import {
  fetchDocumentList,
  fetchDocumentTypeOptions,
  fetchPartnerOptionsForDocuments
} from "@/lib/data/documents";
import { formatDate } from "@/lib/utils";
import { getViewerRole } from "@/lib/auth/require-admin";

type SearchParams = {
  q?: string;
  type?: string;
  status?: string;
  visibility?: string;
  advanced?: string;
};

export default async function DocumentsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const advanced = params.advanced === "1";
  const isAdmin = (await getViewerRole()) === "admin";
  const visibility = params.visibility ?? "current";

  const [{ rows, error }, typeOptions, partnerOptions] = await Promise.all([
    fetchDocumentList({
      q: params.q,
      type: params.type,
      status: isAdmin ? params.status : "all",
      visibility,
      advanced: isAdmin && advanced
    }),
    fetchDocumentTypeOptions(),
    fetchPartnerOptionsForDocuments()
  ]);

  const exportRows = rows.map((row) => ({
    파트너사: row.partner_name,
    문서구분: getDocumentTypeShortLabel(row.document_type),
    파일명: getDocumentDisplayFileName(row),
    계약일자: row.contract_date ? formatDate(row.contract_date) : null,
    업로드일: formatDate(row.created_at),
    상태: isAdmin
      ? getMatchStatusLabel(
          resolveMatchStatus({ match_status: row.match_status, review_status: row.review_status })
        )
      : getPublicDocumentStatusLabel(
          resolveMatchStatus({ match_status: row.match_status, review_status: row.review_status })
        )
  }));

  const tableRows = rows.map((row) => ({
    id: row.id,
    partner_id: row.partner_id,
    partner_name: row.partner_name,
    extracted_partner_name: row.extracted_partner_name,
    document_type: row.document_type,
    display_name: row.display_name,
    file_name: row.file_name,
    original_filename: row.original_filename,
    file_ext: row.file_ext,
    contract_date: row.contract_date,
    created_at: row.created_at,
    match_status: row.match_status,
    review_status: row.review_status,
    grade_from_file: row.grade_from_file,
    note: row.note,
    summary: row.summary,
    is_duplicate: row.is_duplicate,
    is_active: row.is_active,
    duplicate_reason: row.duplicate_reason
  }));

  return (
    <>
      <PageHeader
        title="문서 관리"
        description="파트너 계약서, 신청서, 사업자등록증 등 운영 문서를 조회·다운로드합니다."
        action={<CsvDownloadButton rows={exportRows} filenamePrefix="partner-documents" />}
      />

      <DocumentsToolbar isAdmin={isAdmin} />

      <form className="ui-toolbar mb-5 lg:flex-nowrap">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="파트너사, 문서 구분, 파일명 검색"
          className="ui-input min-w-[220px] flex-1"
        />
        <select name="type" defaultValue={params.type ?? "all"} className="ui-select w-40 shrink-0">
          <option value="all">전체 유형</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {getDocumentTypeShortLabel(type)}
            </option>
          ))}
        </select>
        {isAdmin ? (
          <>
            <select name="visibility" defaultValue={visibility} className="ui-select w-44 shrink-0">
              <option value="current">최신본</option>
              <option value="archived">구버전</option>
              <option value="all">전체</option>
              <option value="hidden">중복 숨김</option>
              <option value="duplicate_candidate">중복 후보</option>
              <option value="needs_review">확인 필요</option>
            </select>
            <select name="status" defaultValue={params.status ?? "all"} className="ui-select w-44 shrink-0">
              <option value="all">전체 상태</option>
              <option value="matched">정상·수동확인</option>
              <option value="needs_review">확인 필요</option>
              <option value="unmatched">미연결</option>
            </select>
            <label className="flex shrink-0 items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="advanced" value="1" defaultChecked={advanced} />
              원본 파일명 포함 검색
            </label>
          </>
        ) : (
          <input type="hidden" name="visibility" value="current" />
        )}
        <button type="submit" className="ui-btn-accent shrink-0">
          검색
        </button>
      </form>

      <div className="mb-3 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{rows.length}</span>건
        {!isAdmin ? (
          <span className="ml-2 text-slate-400">· 최신본 문서만 표시</span>
        ) : null}
      </div>

      {error ? (
        <EmptyState title="문서 목록을 불러오지 못했습니다." description={error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="등록된 문서가 없습니다."
          description="문서 업로드 메뉴에서 계약서, 신청서, 사업자등록증 등을 등록할 수 있습니다."
        />
      ) : (
        <DocumentsListTable rows={tableRows} partnerOptions={partnerOptions} isAdmin={isAdmin} />
      )}
    </>
  );
}
