"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/layout/page-header";
import {
  parsePartnerContractsWorkbook,
  type ParseResult,
  type ParsedPartnerRow
} from "@/lib/excel/parse-partner-contracts";
import {
  parsePartnerContactsWorkbook,
  type PartnerContactsParseResult
} from "@/lib/excel/parse-partner-contacts";
import { PARTNER_CONTACTS_ACTION_LABEL } from "@/lib/imports/partner-contacts";
import {
  parsePartnerMasterWorkbook,
  type PartnerMasterParseResult,
  type ParsedPartnerMasterRow
} from "@/lib/excel/parse-partner-master";
import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import {
  parseTrainingAttendanceWorkbook,
  type TrainingAttendanceParseResult
} from "@/lib/excel/parse-training-attendance-detail";
import { PartnerDocumentsUploadSection } from "@/components/upload/partner-documents-upload-section";
import { PartnerApplicationUploadSection } from "@/components/upload/partner-application-upload-section";
import { PartnerDuplicatesPanel } from "@/components/upload/partner-duplicates-panel";
import { ImportJobsPanel } from "@/components/upload/import-jobs-panel";
import { PARTNER_MASTER_ACTION_LABEL } from "@/lib/imports/partner-master";
import {
  parsePartnerEquipmentWorkbook,
  type PartnerEquipmentParseResult
} from "@/lib/excel/parse-partner-equipment";

type UploadType =
  | "partner_master"
  | "partner_contacts"
  | "partner_training_summary"
  | "training_attendance_detail"
  | "partner_equipment"
  | "partner_documents"
  | "partner_application";

type UploadTypeMeta = {
  key: UploadType;
  menuTitle: string;
  menuHint: string;
  workTitle: string;
  workDescription: string;
  sourceFile: string;
  order: number;
  mode: "active" | "preview_only";
};

type PartnerMasterUploadMode = "update" | "full_sync";

type PartnerMasterAnalysisItem = {
  row_number: number;
  company_name: string;
  business_number: string | null;
  external_no: string | null;
  action: "create" | "update" | "skip" | "review";
  reason: string;
  changed_fields: string[];
  matched_partner_id: string | null;
  warnings?: string[];
};

type PartnerMasterMissingItem = {
  partner_id: string;
  company_name: string;
  external_no: string | null;
  business_number: string | null;
};

type PartnerMasterAnalysisSummary = {
  total: number;
  create: number;
  update: number;
  skip: number;
  review: number;
  missing_from_excel?: number;
  errors?: number;
};

type PartnerContactsAnalysisItem = {
  row_number: number;
  partner_no: string | null;
  company_name: string;
  contact_name: string;
  role_raw: string | null;
  role_type: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_contract_contact: boolean;
  action: "create" | "update" | "merge" | "skip" | "review" | "duplicate";
  reason: string;
  matched_partner_name: string | null;
};

type PartnerContactsAnalysisSummary = {
  total: number;
  matched_partners: number;
  create: number;
  update: number;
  skip: number;
  review: number;
  duplicate: number;
  review_missing: number;
  baseline_excluded: number;
  history_only_preserved: number;
  already_inactive: number;
  merge: number;
};

type PartnerContactsBaselineExcludedItem = {
  contact_id: string;
  partner_id: string;
  partner_name: string;
  contact_name: string;
  email: string | null;
  reason: string;
  is_history_only?: boolean;
  category?: "active_current_missing" | "history_only" | "already_inactive";
};

type MatchState<TItem, TSummary> = {
  items: TItem[];
  summary: TSummary;
  loading: boolean;
  error: string | null;
};

type TrainingMatchPreview = {
  new: number;
  update: number;
  loading: boolean;
  error: string | null;
};

type TrainingAttendancePreviewItem = {
  row_number: number;
  company_name: string;
  attendee_name: string;
  training_name: string;
  start_date: string;
  action: "create" | "update" | "skip" | "review";
  reason: string;
  matched_partner_name: string | null;
  matched_training_name: string | null;
};

type TrainingAttendancePreview = {
  items: TrainingAttendancePreviewItem[];
  summary: {
    total: number;
    new_trainings: number;
    new_attendees: number;
    updates: number;
    review: number;
    skipped: number;
    non_partner: number;
  };
  loading: boolean;
  error: string | null;
};

type GenericPreview = {
  sheetNames: string[];
  selectedSheet: string;
  totalRows: number;
  headers: string[];
  rows: Array<Record<string, string>>;
};

type PartnerEquipmentAnalysisItem = {
  row_number: number;
  company_name: string;
  node_name: string | null;
  node_type: string | null;
  cpu: string | null;
  memory: string | null;
  os_disk: string | null;
  ceph_disk: string | null;
  nic: string | null;
  asset_status: string | null;
  memo: string | null;
  action: "create" | "update" | "skip" | "review";
  reason: string;
  matched_partner_name: string | null;
};

type PartnerEquipmentAnalysisSummary = {
  total: number;
  partner_count: number;
  matched_partners: number;
  unmatched_partners: number;
  create: number;
  update: number;
  skip: number;
  review: number;
};

type SaveSummary = {
  total: number;
  source_rows?: number;
  deduped_persons?: number;
  actionable?: number;
  synced?: number;
  current_baseline_count?: number;
  active_current_count?: number;
  baseline_ok?: boolean;
  created: number;
  updated: number;
  deactivated?: number;
  merged?: number;
  emails_added?: number;
  phones_added?: number;
  roles_added?: number;
  baseline_excluded?: number;
  history_only_excluded?: number;
  review_missing?: number;
  skipped?: number;
  review?: number;
  missing_from_excel?: number;
  created_trainings?: number;
  created_attendees?: number;
  errors: number;
};

type SaveResult = {
  company_name: string;
  status: "created" | "updated" | "error" | "skipped" | "review";
  partner_id: string | null;
  message: string | null;
};

const ACCEPTED_EXT = [".xlsx", ".xls", ".csv"];

const UPLOAD_TYPES: UploadTypeMeta[] = [
  {
    key: "partner_master",
    menuTitle: "파트너 기본정보",
    menuHint: "회사 / 계약 / 등급",
    workTitle: "파트너 기본정보 업로드",
    workDescription: "회사·계약·등급 정보를 추가하거나 갱신합니다.",
    sourceFile: "파트너관리.xlsx",
    order: 1,
    mode: "active"
  },
  {
    key: "partner_contacts",
    menuTitle: "인력·담당자",
    menuHint: "최신 담당자 명단 전체 동기화",
    workTitle: "현재 인력·담당자 명단 동기화",
    workDescription: "최신 담당자 명단을 기준으로 동기화합니다. 교육·행사 이력은 유지됩니다.",
    sourceFile: "파트너 전체 DB.xlsx",
    order: 2,
    mode: "active"
  },
  {
    key: "partner_training_summary",
    menuTitle: "파트너 교육",
    menuHint: "파트너 교육 이력",
    workTitle: "파트너 교육 업로드",
    workDescription: "파트너 교육 이력을 반영합니다.",
    sourceFile: "파트너 교육.xlsx",
    order: 3,
    mode: "active"
  },
  {
    key: "training_attendance_detail",
    menuTitle: "정기교육 참석자",
    menuHint: "정기교육 상세 참석자",
    workTitle: "정기교육 참석자 업로드",
    workDescription: "정기교육 상세 참석자 명단을 반영합니다.",
    sourceFile: "2026 오케스트로 정기교육 관리시트.xlsx",
    order: 4,
    mode: "active"
  },
  {
    key: "partner_equipment",
    menuTitle: "장비현황",
    menuHint: "파트너 보유 장비",
    workTitle: "장비현황 업로드",
    workDescription: "파트너 보유 장비를 노드 단위로 반영합니다.",
    sourceFile: "3. 기술파트너교육_ 교육생 관리대장(장비스펙).xlsx",
    order: 5,
    mode: "active"
  },
  {
    key: "partner_documents",
    menuTitle: "파트너 문서",
    menuHint: "계약서 / 신청서 / 사업자등록증 등",
    workTitle: "파트너 문서 업로드",
    workDescription: "계약서, 신청서, 사업자등록증 등 문서를 등록합니다.",
    sourceFile: "문서 폴더 (ZIP 해제 후)",
    order: 6,
    mode: "active"
  },
  {
    key: "partner_application",
    menuTitle: "파트너 신청서",
    menuHint: "신규 파트너 신청 등록",
    workTitle: "파트너 신청서 등록",
    workDescription: "신규 파트너 신청서를 분석하고 등록합니다.",
    sourceFile: "파트너 신청서.xlsx",
    order: 7,
    mode: "active"
  }
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedType, setSelectedType] = useState<UploadType>("partner_master");
  const [partnerMasterUploadMode, setPartnerMasterUploadMode] =
    useState<PartnerMasterUploadMode>("update");
  const [partnerMasterMissing, setPartnerMasterMissing] = useState<PartnerMasterMissingItem[]>(
    []
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [partnerMasterResult, setPartnerMasterResult] =
    useState<PartnerMasterParseResult | null>(null);
  const [partnerContactsResult, setPartnerContactsResult] =
    useState<PartnerContactsParseResult | null>(null);
  const [partnerTrainingResult, setPartnerTrainingResult] = useState<ParseResult | null>(null);
  const [trainingAttendanceResult, setTrainingAttendanceResult] =
    useState<TrainingAttendanceParseResult | null>(null);
  const [partnerEquipmentResult, setPartnerEquipmentResult] =
    useState<PartnerEquipmentParseResult | null>(null);
  const [genericPreview, setGenericPreview] = useState<GenericPreview | null>(null);

  const [partnerMasterPreview, setPartnerMasterPreview] = useState<
    MatchState<PartnerMasterAnalysisItem, PartnerMasterAnalysisSummary>
  >({
    items: [],
    summary: { total: 0, create: 0, update: 0, skip: 0, review: 0, missing_from_excel: 0 },
    loading: false,
    error: null
  });
  const [partnerContactsPreview, setPartnerContactsPreview] = useState<
    MatchState<PartnerContactsAnalysisItem, PartnerContactsAnalysisSummary>
  >({
    items: [],
    summary: {
      total: 0,
      matched_partners: 0,
      create: 0,
      update: 0,
      skip: 0,
      review: 0,
      duplicate: 0,
      review_missing: 0,
      baseline_excluded: 0,
      history_only_preserved: 0,
      already_inactive: 0,
      merge: 0
    },
    loading: false,
    error: null
  });
  const [partnerContactsBaselineExcluded, setPartnerContactsBaselineExcluded] = useState<
    PartnerContactsBaselineExcludedItem[]
  >([]);
  const [partnerContactsHistoryOnly, setPartnerContactsHistoryOnly] = useState<
    PartnerContactsBaselineExcludedItem[]
  >([]);
  const [partnerEquipmentPreview, setPartnerEquipmentPreview] = useState<
    MatchState<PartnerEquipmentAnalysisItem, PartnerEquipmentAnalysisSummary>
  >({
    items: [],
    summary: { total: 0, partner_count: 0, matched_partners: 0, unmatched_partners: 0, create: 0, update: 0, skip: 0, review: 0 },
    loading: false,
    error: null
  });
  const [trainingMatchPreview, setTrainingMatchPreview] = useState<TrainingMatchPreview>({
    new: 0,
    update: 0,
    loading: false,
    error: null
  });
  const [trainingAttendancePreview, setTrainingAttendancePreview] =
    useState<TrainingAttendancePreview>({
      items: [],
      summary: {
        total: 0,
        new_trainings: 0,
        new_attendees: 0,
        updates: 0,
        review: 0,
        skipped: 0,
        non_partner: 0
      },
      loading: false,
      error: null
    });

  const [isSaving, setIsSaving] = useState(false);
  const [saveCompleted, setSaveCompleted] = useState(false);
  const [forceReprocess, setForceReprocess] = useState(false);
  const saveLockRef = useRef(false);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [saveResults, setSaveResults] = useState<SaveResult[]>([]);
  /** 업로드 유형별 저장 오류 — 다른 작업 stale error가 섞이지 않음 */
  const [saveErrorsByType, setSaveErrorsByType] = useState<
    Partial<Record<UploadType, string | null>>
  >({});

  const selectedMeta = UPLOAD_TYPES.find((item) => item.key === selectedType)!;
  const saveError = saveErrorsByType[selectedType] ?? null;

  const emptyContactsSummary = (): PartnerContactsAnalysisSummary => ({
    total: 0,
    matched_partners: 0,
    create: 0,
    update: 0,
    skip: 0,
    review: 0,
    duplicate: 0,
    review_missing: 0,
    baseline_excluded: 0,
    history_only_preserved: 0,
    already_inactive: 0,
    merge: 0
  });

  function setSaveErrorForType(type: UploadType, message: string | null) {
    setSaveErrorsByType((prev) => ({ ...prev, [type]: message }));
  }

  const importableTrainingRows = useMemo(
    () => (partnerTrainingResult ? partnerTrainingResult.rows.filter((row) => !row.excluded) : []),
    [partnerTrainingResult]
  );

  useEffect(() => {
    resetState();
    setSaveCompleted(false);
    setForceReprocess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedType]);

  useEffect(() => {
    if (selectedType !== "partner_master" || !partnerMasterResult) {
      setPartnerMasterPreview({
        items: [],
        summary: { total: 0, create: 0, update: 0, skip: 0, review: 0, missing_from_excel: 0 },
        loading: false,
        error: null
      });
      return;
    }

    let cancelled = false;
    setPartnerMasterPreview((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch("/api/import/partners/master/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: partnerMasterResult.rows,
            upload_mode: partnerMasterUploadMode
          })
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "파트너 기본정보 미리보기에 실패했습니다.");
        }
        setPartnerMasterPreview({
          items: json.items as PartnerMasterAnalysisItem[],
          summary: json.summary as PartnerMasterAnalysisSummary,
          loading: false,
          error: null
        });
        setPartnerMasterMissing((json.missing_from_excel ?? []) as PartnerMasterMissingItem[]);
      } catch (error) {
        if (cancelled) return;
        setPartnerMasterPreview({
          items: [],
          summary: { total: 0, create: 0, update: 0, skip: 0, review: 0, missing_from_excel: 0 },
          loading: false,
          error: error instanceof Error ? error.message : "파트너 기본정보 미리보기에 실패했습니다."
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partnerMasterResult, selectedType, partnerMasterUploadMode]);

  useEffect(() => {
    if (selectedType !== "partner_contacts" || !partnerContactsResult) {
      setPartnerContactsPreview({
        items: [],
        summary: emptyContactsSummary(),
        loading: false,
        error: null
      });
      setPartnerContactsBaselineExcluded([]);
      setPartnerContactsHistoryOnly([]);
      return;
    }

    let cancelled = false;
    setPartnerContactsPreview((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch("/api/import/partners/contacts/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: partnerContactsResult.rows })
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "담당자 업로드 미리보기에 실패했습니다.");
        }
        setPartnerContactsPreview({
          items: json.items as PartnerContactsAnalysisItem[],
          summary: {
            ...emptyContactsSummary(),
            ...(json.summary as PartnerContactsAnalysisSummary)
          },
          loading: false,
          error: null
        });
        setPartnerContactsBaselineExcluded(
          (json.baselineExcluded ?? []) as PartnerContactsBaselineExcludedItem[]
        );
        setPartnerContactsHistoryOnly(
          (json.historyOnlyPreserved ?? []) as PartnerContactsBaselineExcludedItem[]
        );
        // 분석 성공 시 이 유형의 이전 저장 오류만 제거 (다른 유형 error는 유지)
        setSaveErrorForType("partner_contacts", null);
      } catch (error) {
        if (cancelled) return;
        setPartnerContactsPreview({
          items: [],
          summary: emptyContactsSummary(),
          loading: false,
          error: error instanceof Error ? error.message : "담당자 업로드 미리보기에 실패했습니다."
        });
        setPartnerContactsBaselineExcluded([]);
        setPartnerContactsHistoryOnly([]);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerContactsResult, selectedType]);

  useEffect(() => {
    if (selectedType !== "partner_equipment" || !partnerEquipmentResult) {
      setPartnerEquipmentPreview({
        items: [],
        summary: { total: 0, partner_count: 0, matched_partners: 0, unmatched_partners: 0, create: 0, update: 0, skip: 0, review: 0 },
        loading: false,
        error: null
      });
      return;
    }

    let cancelled = false;
    setPartnerEquipmentPreview((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch("/api/import/partners/equipment/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: partnerEquipmentResult.rows })
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "장비 업로드 미리보기에 실패했습니다.");
        }
        setPartnerEquipmentPreview({
          items: json.items as PartnerEquipmentAnalysisItem[],
          summary: json.summary as PartnerEquipmentAnalysisSummary,
          loading: false,
          error: null
        });
      } catch (error) {
        if (cancelled) return;
        setPartnerEquipmentPreview({
          items: [],
          summary: { total: 0, partner_count: 0, matched_partners: 0, unmatched_partners: 0, create: 0, update: 0, skip: 0, review: 0 },
          loading: false,
          error: error instanceof Error ? error.message : "장비 업로드 미리보기에 실패했습니다."
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partnerEquipmentResult, selectedType]);

  useEffect(() => {
    if (selectedType !== "training_attendance_detail" || !trainingAttendanceResult) {
      setTrainingAttendancePreview({
        items: [],
        summary: {
          total: 0,
          new_trainings: 0,
          new_attendees: 0,
          updates: 0,
          review: 0,
          skipped: 0,
          non_partner: 0
        },
        loading: false,
        error: null
      });
      return;
    }

    let cancelled = false;
    setTrainingAttendancePreview((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch("/api/import/trainings/attendance/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: trainingAttendanceResult.rows })
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "정기교육 참석자 미리보기에 실패했습니다.");
        }
        console.log("[upload] training attendance match", json.summary);
        setTrainingAttendancePreview({
          items: json.items as TrainingAttendancePreviewItem[],
          summary: json.summary as TrainingAttendancePreview["summary"],
          loading: false,
          error: null
        });
      } catch (error) {
        if (cancelled) return;
        setTrainingAttendancePreview({
          items: [],
          summary: {
            total: 0,
            new_trainings: 0,
            new_attendees: 0,
            updates: 0,
            review: 0,
            skipped: 0,
            non_partner: 0
          },
          loading: false,
          error:
            error instanceof Error ? error.message : "정기교육 참석자 미리보기에 실패했습니다."
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedType, trainingAttendanceResult]);

  useEffect(() => {
    if (
      selectedType !== "partner_training_summary" ||
      !partnerTrainingResult ||
      importableTrainingRows.length === 0
    ) {
      setTrainingMatchPreview({ new: 0, update: 0, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setTrainingMatchPreview((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch("/api/import/partners/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_strategy: "company_name",
            rows: importableTrainingRows.map((row) => ({ company_name: row.company_name }))
          })
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "교육 요약 매칭 미리보기에 실패했습니다.");
        }
        setTrainingMatchPreview({
          new: json.summary.new as number,
          update: json.summary.update as number,
          loading: false,
          error: null
        });
      } catch (error) {
        if (cancelled) return;
        setTrainingMatchPreview({
          new: 0,
          update: 0,
          loading: false,
          error: error instanceof Error ? error.message : "교육 요약 매칭 미리보기에 실패했습니다."
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [importableTrainingRows, partnerTrainingResult, selectedType]);

  const processFile = useCallback(
    async (file: File) => {
      resetState();

      const ext = file.name.toLowerCase().split(".").pop();
      if (!ext || !ACCEPTED_EXT.includes(`.${ext}`)) {
        setParseError(`지원하지 않는 형식입니다. 사용 가능한 확장자: ${ACCEPTED_EXT.join(", ")}`);
        return;
      }

      setIsParsing(true);
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { cellDates: true });

        if (workbook.SheetNames.length === 0) {
          throw new Error("업로드 파일에 시트가 없습니다.");
        }

        setFileName(file.name);
        setSourceFile(file);
        setSaveCompleted(false);
        setSaveSummary(null);
        setSaveResults([]);
        setSaveErrorForType(selectedType, null);

        if (selectedType === "partner_master") {
          const result = parsePartnerMasterWorkbook(workbook);
          if (result.total_rows === 0) throw new Error("시트에서 읽을 데이터가 없습니다.");
          setPartnerMasterResult(result);
          return;
        }

        if (selectedType === "partner_contacts") {
          const result = parsePartnerContactsWorkbook(workbook);
          if (result.total_rows === 0) throw new Error("시트에서 읽을 데이터가 없습니다.");
          setPartnerContactsResult(result);
          return;
        }

        if (selectedType === "partner_training_summary") {
          const result = parsePartnerContractsWorkbook(workbook);
          if (result.total_rows === 0) throw new Error("시트에서 읽을 데이터가 없습니다.");
          setPartnerTrainingResult(result);
          return;
        }

        if (selectedType === "training_attendance_detail") {
          const result = parseTrainingAttendanceWorkbook(workbook);
          console.log("[upload] training attendance parse", result);
          if (result.total_rows === 0) throw new Error("시트에서 읽을 데이터가 없습니다.");
          setTrainingAttendanceResult(result);
          return;
        }

        if (selectedType === "partner_equipment") {
          const result = parsePartnerEquipmentWorkbook(workbook);
          if (result.total_rows === 0) throw new Error("시트에서 읽을 데이터가 없습니다.");
          setPartnerEquipmentResult(result);
          return;
        }

        setGenericPreview(buildGenericPreview(workbook));
      } catch (error) {
        setFileName(null);
        setParseError(error instanceof Error ? error.message : "업로드 파일을 읽지 못했습니다.");
      } finally {
        setIsParsing(false);
      }
    },
    [selectedType]
  );

  function resetState() {
    setPartnerMasterResult(null);
    setPartnerContactsResult(null);
    setPartnerTrainingResult(null);
    setTrainingAttendanceResult(null);
    setPartnerEquipmentResult(null);
    setGenericPreview(null);
    setPartnerMasterMissing([]);
    setPartnerMasterPreview({
      items: [],
      summary: { total: 0, create: 0, update: 0, skip: 0, review: 0, missing_from_excel: 0 },
      loading: false,
      error: null
    });
    setPartnerContactsPreview({
      items: [],
      summary: emptyContactsSummary(),
      loading: false,
      error: null
    });
    setPartnerContactsBaselineExcluded([]);
    setPartnerContactsHistoryOnly([]);
    setPartnerEquipmentPreview({
      items: [],
      summary: { total: 0, partner_count: 0, matched_partners: 0, unmatched_partners: 0, create: 0, update: 0, skip: 0, review: 0 },
      loading: false,
      error: null
    });
    setTrainingMatchPreview({ new: 0, update: 0, loading: false, error: null });
    setTrainingAttendancePreview({
      items: [],
      summary: {
        total: 0,
        new_trainings: 0,
        new_attendees: 0,
        updates: 0,
        review: 0,
        skipped: 0,
        non_partner: 0
      },
      loading: false,
      error: null
    });
    setSaveSummary(null);
    setSaveResults([]);
    setSaveErrorForType(selectedType, null);
    setParseError(null);
    setFileName(null);
    setSourceFile(null);
  }

  function clearFile() {
    resetState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void processFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void processFile(file);
  }

  async function importEmbeddedPartnerRevenue(file: File | null): Promise<void> {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.set("file", file);
      await fetch("/api/import/partners/revenue", { method: "POST", body: formData });
    } catch {
      // 매출 시트가 없거나 파싱 실패 시 파트너/전체DB 업로드는 계속 성공 처리
    }
  }

  async function uploadTempStoragePath(file: File, importType: string): Promise<string | null> {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("import_type", importType);
    const response = await fetch("/api/import/temp-file", { method: "POST", body: formData });
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      storage_path?: string;
    } | null;
    if (!response.ok || !json?.ok) return null;
    return json.storage_path ?? null;
  }

  async function handleSave() {
    if (saveLockRef.current || isSaving || saveCompleted) return;
    saveLockRef.current = true;
    try {
      setIsSaving(true);
      setSaveErrorForType(selectedType, null);
      setSaveSummary(null);
      setSaveResults([]);

      if (selectedType === "partner_master" && partnerMasterResult && fileName) {
        const response = await fetch("/api/import/partners/master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: fileName,
            rows: partnerMasterResult.rows,
            upload_mode: partnerMasterUploadMode
          })
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json?.message ?? "저장 중 오류가 발생했습니다.");
        setSaveSummary(json.summary as SaveSummary);
        setSaveResults((json.results ?? []) as SaveResult[]);
        setSaveCompleted(true);
        await importEmbeddedPartnerRevenue(sourceFile);
        router.refresh();
        return;
      }

      if (selectedType === "partner_contacts" && partnerContactsResult && fileName) {
        const storagePath = sourceFile
          ? await uploadTempStoragePath(sourceFile, "contact_full_db")
          : null;
        const response = await fetch("/api/import/partners/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: fileName,
            storage_path: storagePath,
            rows: partnerContactsResult.rows,
            force_reprocess: forceReprocess
          })
        });
        const json = await response.json();
        if (response.status === 409) {
          throw new Error(json?.message ?? "이미 처리 중이거나 처리된 파일입니다.");
        }
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "저장 중 오류가 발생했습니다.");
        }
        setSaveSummary(json.summary as SaveSummary);
        setSaveResults((json.results ?? []) as SaveResult[]);
        setSaveCompleted(true);
        const revenueFile = sourceFile;
        // 새로고침 시 재저장 방지: 파싱 결과 클리어
        setPartnerContactsResult(null);
        setPartnerContactsPreview({
          items: [],
          summary: emptyContactsSummary(),
          loading: false,
          error: null
        });
        setPartnerContactsBaselineExcluded([]);
        setPartnerContactsHistoryOnly([]);
        setSourceFile(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await importEmbeddedPartnerRevenue(revenueFile);
        router.refresh();
        return;
      }

      if (selectedType === "partner_training_summary" && partnerTrainingResult) {
        const response = await fetch("/api/import/partners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_strategy: "company_name",
            rows: partnerTrainingResult.rows
          })
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json?.message ?? "저장 중 오류가 발생했습니다.");
        setSaveSummary(json.summary as SaveSummary);
        setSaveResults((json.results ?? []) as SaveResult[]);
        setSaveCompleted(true);
        router.refresh();
        return;
      }

      if (selectedType === "training_attendance_detail" && trainingAttendanceResult && fileName) {
        const storagePath = sourceFile
          ? await uploadTempStoragePath(sourceFile, "education_attendee_upload")
          : null;
        const response = await fetch("/api/import/trainings/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: fileName,
            storage_path: storagePath,
            rows: trainingAttendanceResult.rows
          })
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json?.message ?? "저장 중 오류가 발생했습니다.");
        setSaveSummary(json.summary as SaveSummary);
        setSaveResults((json.results ?? []) as SaveResult[]);
        setSaveCompleted(true);
        router.refresh();
        return;
      }

      if (selectedType === "partner_equipment" && partnerEquipmentResult && fileName) {
        const response = await fetch("/api/import/partners/equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_name: fileName, rows: partnerEquipmentResult.rows })
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json?.message ?? "저장 중 오류가 발생했습니다.");
        setSaveSummary(json.summary as SaveSummary);
        setSaveResults((json.results ?? []) as SaveResult[]);
        setSaveCompleted(true);
        router.refresh();
        return;
      }
    } catch (error) {
      setSaveErrorForType(
        selectedType,
        error instanceof Error ? error.message : "저장에 실패했습니다."
      );
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  }

  const trainingAnalysisTotal =
    trainingAttendancePreview.summary.new_trainings +
    trainingAttendancePreview.summary.new_attendees +
    trainingAttendancePreview.summary.updates +
    trainingAttendancePreview.summary.review +
    trainingAttendancePreview.summary.skipped;

  const analyzeBlockingError =
    (selectedType === "partner_master" && !!partnerMasterPreview.error) ||
    (selectedType === "partner_contacts" &&
      (!!partnerContactsPreview.error || partnerContactsPreview.loading)) ||
    (selectedType === "partner_equipment" && !!partnerEquipmentPreview.error) ||
    (selectedType === "partner_training_summary" && !!trainingMatchPreview.error) ||
    (selectedType === "training_attendance_detail" && !!trainingAttendancePreview.error);

  const canSave =
    !saveCompleted &&
    !analyzeBlockingError &&
    ((selectedType === "partner_master" && !!partnerMasterResult) ||
      (selectedType === "partner_contacts" &&
        !!partnerContactsResult &&
        partnerContactsPreview.summary.total > 0) ||
      (selectedType === "partner_training_summary" && !!partnerTrainingResult) ||
      (selectedType === "partner_equipment" &&
        !!partnerEquipmentResult &&
        !partnerEquipmentPreview.loading &&
        partnerEquipmentPreview.summary.total > 0) ||
      (selectedType === "training_attendance_detail" &&
        !!trainingAttendanceResult &&
        !trainingAttendancePreview.loading &&
        trainingAnalysisTotal > 0));

  const contactReviewItems = partnerContactsPreview.items.filter(
    (item) => item.action === "review" || item.action === "duplicate"
  );

  const reviewCount =
    selectedType === "partner_master"
      ? partnerMasterPreview.summary.review
      : selectedType === "partner_contacts"
        ? partnerContactsPreview.summary.review + partnerContactsPreview.summary.duplicate
        : selectedType === "partner_equipment"
          ? partnerEquipmentPreview.summary.review
        : selectedType === "training_attendance_detail"
          ? trainingAttendancePreview.summary.review
          : 0;

  return (
    <>
      <PageHeader
        title="데이터 업로드"
        description="위에서 업로드 종류를 선택한 뒤, 아래 작업 영역에서 파일을 올리고 저장합니다."
      />

      <UploadTypeSelector selectedType={selectedType} onChange={setSelectedType} />

      {selectedType === "partner_master" ? <PartnerDuplicatesPanel /> : null}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-base font-semibold text-slate-900">{selectedMeta.workTitle}</div>
          <p className="mt-1 text-sm text-slate-600">{selectedMeta.workDescription}</p>
          <p className="mt-2 text-xs text-slate-400">권장 파일: {selectedMeta.sourceFile}</p>
        </div>

        {selectedType === "partner_master" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label
              className={[
                "cursor-pointer rounded-xl border p-3 text-sm",
                partnerMasterUploadMode === "update"
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              ].join(" ")}
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <input
                  type="radio"
                  name="partner_master_upload_mode"
                  checked={partnerMasterUploadMode === "update"}
                  onChange={() => setPartnerMasterUploadMode("update")}
                />
                갱신 업로드
              </span>
              <span className="mt-1 block pl-6 text-xs leading-relaxed text-slate-500">
                현재 Excel에 있는 파트너만 추가/갱신합니다.
              </span>
            </label>
            <label
              className={[
                "cursor-pointer rounded-xl border p-3 text-sm",
                partnerMasterUploadMode === "full_sync"
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              ].join(" ")}
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <input
                  type="radio"
                  name="partner_master_upload_mode"
                  checked={partnerMasterUploadMode === "full_sync"}
                  onChange={() => setPartnerMasterUploadMode("full_sync")}
                />
                전체 동기화
              </span>
              <span className="mt-1 block pl-6 text-xs leading-relaxed text-slate-500">
                Excel에 없는 기존 파트너도 비교 대상으로 표시합니다. 자동 삭제하지 않습니다.
              </span>
            </label>
          </div>
        ) : null}

        {selectedType === "partner_contacts" ? (
          <div className="mt-4">
            <ImportJobsPanel importType="contact_full_db_upload" pollFast={isSaving} />
          </div>
        ) : null}

        {selectedType === "partner_documents" ? (
          <div className="mt-5">
            <PartnerDocumentsUploadSection />
          </div>
        ) : selectedType === "partner_application" ? (
          <div className="mt-5">
            <PartnerApplicationUploadSection embedded />
          </div>
        ) : (
          <>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={[
            "mt-5 rounded-2xl border border-dashed px-6 py-10 text-center transition",
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 bg-slate-50"
          ].join(" ")}
        >
          <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
          <div className="mt-3 text-sm font-semibold text-slate-900">
            파일을 여기에 끌어다 놓거나 클릭해서 선택하세요
          </div>
          <div className="mt-1 text-xs text-slate-500">{ACCEPTED_EXT.join(", ")}</div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              파일 선택
            </button>
            {fileName ? (
              <button
                type="button"
                onClick={clearFile}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-rose-300 hover:text-rose-600"
              >
                <X size={14} />
                파일 초기화
              </button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT.join(",")}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {fileName ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <FileSpreadsheet size={16} />
            <span className="font-medium">{fileName}</span>
          </div>
        ) : null}

        {isParsing ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
            <Loader2 size={16} className="animate-spin" />
            파일을 분석 중입니다.
          </div>
        ) : null}

        {parseError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {parseError}
          </div>
        ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SummaryPanel
          selectedType={selectedType}
          selectedMeta={selectedMeta}
          partnerMasterResult={partnerMasterResult}
          partnerMasterPreview={partnerMasterPreview}
          partnerMasterMissing={partnerMasterMissing}
          partnerContactsResult={partnerContactsResult}
          partnerContactsPreview={partnerContactsPreview}
          partnerEquipmentResult={partnerEquipmentResult}
          partnerEquipmentPreview={partnerEquipmentPreview}
          partnerTrainingResult={partnerTrainingResult}
          trainingMatchPreview={trainingMatchPreview}
          trainingAttendanceResult={trainingAttendanceResult}
          trainingAttendancePreview={trainingAttendancePreview}
          genericPreview={genericPreview}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">저장</div>
          <div className="mt-1 text-sm text-slate-500">분석 결과를 확인한 뒤 실제 저장을 실행합니다.</div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving || selectedMeta.mode !== "active"}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isSaving ? "저장 중…" : saveCompleted ? "저장 완료" : "저장 실행"}
          </button>

          {selectedType === "partner_contacts" ? (
            <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={forceReprocess}
                onChange={(event) => setForceReprocess(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                동일 파일 강제 재실행 (이미 처리된 파일도 다시 저장). 일반 재업로드는 체크하지
                마세요.
              </span>
            </label>
          ) : null}

          {saveCompleted ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              저장이 완료되었습니다. 새로고침해도 저장이 다시 실행되지 않습니다. 다시 저장하려면
              파일을 다시 선택하세요.
            </div>
          ) : null}

          {selectedMeta.mode !== "active" ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              이 업로드 유형은 아직 저장 로직이 구현되지 않았습니다.
            </div>
          ) : null}

          {selectedType === "training_attendance_detail" &&
          trainingAttendanceResult &&
          !trainingAttendancePreview.loading &&
          trainingAnalysisTotal === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              분석 결과가 0건입니다. 시트/컬럼 매핑을 확인한 뒤 다시 업로드해 주세요.
            </div>
          ) : null}

          {selectedType === "partner_contacts" &&
          partnerContactsPreview.summary.baseline_excluded > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              현재 명단에서 제외 예정 {partnerContactsPreview.summary.baseline_excluded}명
              (is_active + in_current_full_db). 교육/행사 이력{" "}
              {partnerContactsPreview.summary.history_only_preserved}명 · 이미 비활성{" "}
              {partnerContactsPreview.summary.already_inactive}명은 제외 예정에 포함하지 않습니다.
            </div>
          ) : null}

          {selectedType === "partner_contacts" && partnerContactsPreview.error ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              분석 오류: {partnerContactsPreview.error}
            </div>
          ) : null}

          {reviewCount > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              확인필요 예정 {reviewCount}건은 자동 저장되지 않고 review queue로 들어갑니다.
            </div>
          ) : null}

          {saveError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {saveError}
            </div>
          ) : null}

          {saveSummary ? (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">저장 결과</div>
              {selectedType === "partner_contacts" && saveSummary.baseline_ok === false ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  저장 성공 수와 current baseline 반영 수가 일치하지 않습니다. 성공으로 간주하지
                  마세요.
                </div>
              ) : null}
              <ResultLine label="원본 행 수" value={saveSummary.source_rows ?? saveSummary.total} />
              {saveSummary.deduped_persons != null ? (
                <ResultLine label="파일 내 병합 후 인원" value={saveSummary.deduped_persons} />
              ) : null}
              {saveSummary.actionable != null ? (
                <ResultLine label="저장 대상" value={saveSummary.actionable} />
              ) : null}
              {saveSummary.synced != null ? (
                <ResultLine label="실제 저장 성공" value={saveSummary.synced} />
              ) : null}
              <ResultLine
                label="current baseline 반영"
                value={saveSummary.active_current_count ?? 0}
              />
              <ResultLine label="신규 추가" value={saveSummary.created} />
              <ResultLine label="기존 갱신" value={saveSummary.updated} />
              <ResultLine label="중복 병합" value={saveSummary.merged ?? 0} />
              <ResultLine
                label="현재 목록에서 제외"
                value={saveSummary.baseline_excluded ?? saveSummary.review_missing ?? 0}
              />
              <ResultLine label="제외(파일)" value={saveSummary.skipped ?? 0} />
              <ResultLine label="검토 필요" value={saveSummary.review ?? 0} />
              <ResultLine label="오류" value={saveSummary.errors} />
              {selectedType === "training_attendance_detail" ? (
                <>
                  <ResultLine label="신규 교육" value={saveSummary.created_trainings ?? 0} />
                  <ResultLine label="신규 참석자" value={saveSummary.created_attendees ?? 0} />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileSpreadsheet size={16} />
          미리보기
        </div>

        {selectedType === "partner_master" && partnerMasterResult ? (
          <>
            <PartnerMasterGradePreviewTable rows={partnerMasterResult.rows.filter((row) => !row.excluded)} />
            <div className="mt-4">
              <PartnerMasterPreviewTable
                items={partnerMasterPreview.items}
                loading={partnerMasterPreview.loading}
              />
            {partnerMasterUploadMode === "full_sync" && partnerMasterMissing.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-amber-800">
                  엑셀에서 누락됨 ({partnerMasterMissing.length}건)
                </p>
                <PreviewTable
                  headers={["파트너번호", "회사명", "사업자번호"]}
                  rows={partnerMasterMissing.slice(0, 50).map((item) => [
                    item.external_no ?? "-",
                    item.company_name,
                    item.business_number ?? "-"
                  ])}
                />
              </div>
            ) : null}
            </div>
          </>
        ) : null}

        {selectedType === "partner_contacts" && partnerContactsResult ? (
          <>
            {contactReviewItems.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-rose-800">
                  이름 없음/검토 필요 ({contactReviewItems.length}건)
                </p>
                <PreviewTable
                  headers={[
                    "row",
                    "회사명",
                    "담당자",
                    "이메일",
                    "전화",
                    "action",
                    "사유"
                  ]}
                  rows={contactReviewItems.map((item) => [
                    String(item.row_number),
                    item.company_name,
                    item.contact_name || "-",
                    item.email ?? "-",
                    item.phone ?? "-",
                    item.action,
                    item.reason
                  ])}
                />
              </div>
            ) : null}
            <PartnerContactsPreviewTable
              items={partnerContactsPreview.items}
              loading={partnerContactsPreview.loading}
            />
            {partnerContactsBaselineExcluded.length > 0 ? (
              <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-amber-900">
                  현재 명단에서 제외 예정 {partnerContactsBaselineExcluded.length}명 펼쳐보기
                  (회사명 / 이름 / 이메일)
                </summary>
                <div className="mt-3">
                  <PreviewTable
                    headers={["회사명", "담당자", "이메일"]}
                    rows={partnerContactsBaselineExcluded.map((item) => [
                      item.partner_name,
                      item.contact_name,
                      item.email ?? "-"
                    ])}
                  />
                </div>
              </details>
            ) : null}
            {partnerContactsHistoryOnly.length > 0 ? (
              <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  교육/행사 이력 보존 {partnerContactsHistoryOnly.length}명 (현재 명단 제외 아님)
                </summary>
                <div className="mt-3">
                  <PreviewTable
                    headers={["회사명", "담당자", "이메일"]}
                    rows={partnerContactsHistoryOnly.slice(0, 100).map((item) => [
                      item.partner_name,
                      item.contact_name,
                      item.email ?? "-"
                    ])}
                  />
                </div>
              </details>
            ) : null}
          </>
        ) : null}

        {selectedType === "partner_training_summary" && partnerTrainingResult ? (
          <PartnerTrainingPreviewTable rows={importableTrainingRows} />
        ) : null}

        {selectedType === "partner_equipment" && partnerEquipmentResult ? (
          <PartnerEquipmentPreviewTable
            items={partnerEquipmentPreview.items}
            loading={partnerEquipmentPreview.loading}
          />
        ) : null}

        {selectedType === "training_attendance_detail" && trainingAttendanceResult ? (
          <TrainingAttendancePreviewTable
            items={trainingAttendancePreview.items}
            loading={trainingAttendancePreview.loading}
          />
        ) : null}

        {!partnerMasterResult &&
        !partnerContactsResult &&
        !partnerTrainingResult &&
        !partnerEquipmentResult &&
        !trainingAttendanceResult &&
        !genericPreview ? (
          <EmptyMessage message="파일을 선택하면 분석 결과와 미리보기가 표시됩니다." />
        ) : null}
      </section>

      {selectedType === "training_attendance_detail" && trainingAttendanceResult ? (
        <TrainingAttendanceDebugPanel result={trainingAttendanceResult} />
      ) : null}

      {(selectedType === "partner_master" && partnerMasterPreview.items.length > 0) ||
      (selectedType === "partner_contacts" && partnerContactsPreview.items.length > 0) ||
      (selectedType === "partner_equipment" && partnerEquipmentPreview.items.length > 0) ||
      (selectedType === "training_attendance_detail" &&
        trainingAttendancePreview.items.length > 0) ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle size={16} />
            확인필요
          </div>
          {selectedType === "partner_master" ? (
            <ReviewList
              rows={partnerMasterPreview.items
                .filter((item) => item.action === "review")
                .map((item) => ({
                  key: `master-${item.row_number}`,
                  title: `${item.company_name} / ${item.business_number ?? "-"}`,
                  description: item.reason
                }))}
            />
          ) : selectedType === "partner_contacts" ? (
            <ReviewList
              rows={partnerContactsPreview.items
                .filter((item) => item.action === "review" || item.action === "duplicate")
                .map((item) => ({
                  key: `contact-${item.row_number}`,
                  title: `${item.company_name} / ${item.contact_name || "(이름 없음)"}`,
                  description: `[${PARTNER_CONTACTS_ACTION_LABEL[item.action]}] ${item.reason}`
                }))}
            />
          ) : selectedType === "partner_equipment" ? (
            <ReviewList
              rows={partnerEquipmentPreview.items
                .filter((item) => item.action === "review")
                .map((item) => ({
                  key: `equipment-${item.row_number}`,
                  title: `${item.company_name} / ${item.node_name ?? "-"}`,
                  description: item.reason
                }))}
            />
          ) : (
            <ReviewList
              rows={trainingAttendancePreview.items
                .filter((item) => item.action === "review")
                .map((item) => ({
                  key: `attendance-${item.row_number}`,
                  title: `${item.company_name} / ${item.attendee_name}`,
                  description: item.reason
                }))}
            />
          )}
        </section>
      ) : null}
        </>
      )}
      </section>
    </>
  );
}

function UploadTypeSelector({
  selectedType,
  onChange
}: {
  selectedType: UploadType;
  onChange: (value: UploadType) => void;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        업로드 종류
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {UPLOAD_TYPES.map((item) => {
          const selected = item.key === selectedType;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={[
                "rounded-xl border px-3 py-3 text-left transition",
                selected
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              ].join(" ")}
            >
              <div className="text-[11px] font-semibold text-slate-400">0{item.order}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.menuTitle}</div>
              <div className="mt-1 text-xs leading-snug text-slate-500">{item.menuHint}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SummaryPanel({
  selectedType,
  selectedMeta,
  partnerMasterResult,
  partnerMasterPreview,
  partnerMasterMissing,
  partnerContactsResult,
  partnerContactsPreview,
  partnerEquipmentResult,
  partnerEquipmentPreview,
  partnerTrainingResult,
  trainingMatchPreview,
  trainingAttendanceResult,
  trainingAttendancePreview,
  genericPreview
}: {
  selectedType: UploadType;
  selectedMeta: UploadTypeMeta;
  partnerMasterResult: PartnerMasterParseResult | null;
  partnerMasterPreview: MatchState<PartnerMasterAnalysisItem, PartnerMasterAnalysisSummary>;
  partnerMasterMissing: PartnerMasterMissingItem[];
  partnerContactsResult: PartnerContactsParseResult | null;
  partnerContactsPreview: MatchState<PartnerContactsAnalysisItem, PartnerContactsAnalysisSummary>;
  partnerEquipmentResult: PartnerEquipmentParseResult | null;
  partnerEquipmentPreview: MatchState<PartnerEquipmentAnalysisItem, PartnerEquipmentAnalysisSummary>;
  partnerTrainingResult: ParseResult | null;
  trainingMatchPreview: TrainingMatchPreview;
  trainingAttendanceResult: TrainingAttendanceParseResult | null;
  trainingAttendancePreview: TrainingAttendancePreview;
  genericPreview: GenericPreview | null;
}) {
  const cards: Array<{
    label: string;
    value: number | string;
    tone?: "default" | "caution" | "alert";
  }> = [];

  if (selectedType === "partner_master" && partnerMasterResult) {
    const missing =
      partnerMasterPreview.summary.missing_from_excel ?? partnerMasterMissing.length;
    cards.push(
      { label: "전체", value: partnerMasterPreview.summary.total },
      { label: "신규", value: partnerMasterPreview.summary.create },
      { label: "갱신", value: partnerMasterPreview.summary.update },
      {
        label: "제외 예정",
        value: missing,
        tone: missing > 0 ? "caution" : "default"
      },
      {
        label: "검토 필요",
        value: partnerMasterPreview.summary.review,
        tone: partnerMasterPreview.summary.review > 0 ? "caution" : "default"
      }
    );
  } else if (selectedType === "partner_contacts" && partnerContactsResult) {
    const excluded = partnerContactsPreview.summary.baseline_excluded;
    const review = partnerContactsPreview.summary.review;
    const dup = partnerContactsPreview.summary.duplicate + partnerContactsPreview.summary.merge;
    cards.push(
      { label: "전체", value: partnerContactsPreview.summary.total },
      { label: "신규", value: partnerContactsPreview.summary.create },
      { label: "갱신", value: partnerContactsPreview.summary.update },
      { label: "제외 예정", value: excluded, tone: excluded > 0 ? "caution" : "default" },
      { label: "검토 필요", value: review, tone: review > 0 ? "caution" : "default" },
      { label: "중복", value: dup, tone: dup > 0 ? "caution" : "default" }
    );
  } else if (selectedType === "partner_equipment" && partnerEquipmentResult) {
    const review = partnerEquipmentPreview.summary.review;
    const skip = partnerEquipmentPreview.summary.skip;
    cards.push(
      { label: "전체", value: partnerEquipmentPreview.summary.total },
      { label: "신규", value: partnerEquipmentPreview.summary.create },
      { label: "갱신", value: partnerEquipmentPreview.summary.update },
      { label: "제외 예정", value: skip, tone: skip > 0 ? "caution" : "default" },
      { label: "검토 필요", value: review, tone: review > 0 ? "caution" : "default" }
    );
  } else if (selectedType === "partner_training_summary" && partnerTrainingResult) {
    const skipped = partnerTrainingResult.excluded_count;
    cards.push(
      { label: "전체", value: partnerTrainingResult.total_rows },
      { label: "신규", value: trainingMatchPreview.new },
      { label: "갱신", value: trainingMatchPreview.update },
      { label: "제외 예정", value: skipped, tone: skipped > 0 ? "caution" : "default" }
    );
  } else if (selectedType === "training_attendance_detail" && trainingAttendanceResult) {
    const review = trainingAttendancePreview.summary.review;
    const skipped = trainingAttendancePreview.summary.skipped;
    cards.push(
      { label: "전체", value: trainingAttendanceResult.total_rows },
      {
        label: "신규",
        value:
          trainingAttendancePreview.summary.new_trainings +
          trainingAttendancePreview.summary.new_attendees
      },
      { label: "갱신", value: trainingAttendancePreview.summary.updates },
      { label: "제외 예정", value: skipped, tone: skipped > 0 ? "caution" : "default" },
      {
        label: "비파트너 교육생",
        value: trainingAttendancePreview.summary.non_partner ?? 0
      },
      { label: "검토 필요", value: review, tone: review > 0 ? "caution" : "default" }
    );
  } else if (genericPreview) {
    cards.push(
      { label: "전체", value: genericPreview.totalRows },
      { label: "시트", value: genericPreview.selectedSheet }
    );
  }

  const analysisError =
    (selectedType === "partner_master" && partnerMasterPreview.error) ||
    (selectedType === "partner_contacts" && partnerContactsPreview.error) ||
    (selectedType === "partner_equipment" && partnerEquipmentPreview.error) ||
    (selectedType === "partner_training_summary" && trainingMatchPreview.error) ||
    (selectedType === "training_attendance_detail" && trainingAttendancePreview.error) ||
    null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-sm font-semibold text-slate-900">분석 결과</div>
      {cards.length === 0 ? (
        <p className="text-sm text-slate-500">파일을 선택하면 분석 결과가 여기에 표시됩니다.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className={[
                "rounded-xl border p-4",
                card.tone === "alert"
                  ? "border-rose-200 bg-rose-50"
                  : card.tone === "caution"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
              ].join(" ")}
            >
              <div
                className={[
                  "text-xs font-semibold",
                  card.tone === "alert"
                    ? "text-rose-700"
                    : card.tone === "caution"
                      ? "text-amber-800"
                      : "text-slate-400"
                ].join(" ")}
              >
                {card.label}
              </div>
              <div
                className={[
                  "mt-2 text-lg font-bold",
                  card.tone === "alert"
                    ? "text-rose-900"
                    : card.tone === "caution"
                      ? "text-amber-950"
                      : "text-slate-950"
                ].join(" ")}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {analysisError ? <ErrorBox message={analysisError} /> : null}

      {selectedType === "partner_contacts" && partnerContactsResult ? (
        <p className="mt-3 text-xs text-slate-500">
          교육/행사 이력 {partnerContactsPreview.summary.history_only_preserved ?? 0}명, 이미
          비활성 {partnerContactsPreview.summary.already_inactive ?? 0}명은 제외 예정에 넣지
          않습니다.
        </p>
      ) : null}
    </div>
  );
}

function PartnerMasterGradePreviewTable({ rows }: { rows: ParsedPartnerMasterRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold text-slate-600">등급 적용 미리보기</p>
      <PreviewTable
        headers={["회사명", "등급", "등급(변경)", "최종 적용 등급"]}
        rows={rows.slice(0, 50).map((row) => [
          row.company_name,
          row.grade_original ?? "-",
          row.grade_change_raw ?? "-",
          PARTNER_GRADE_LABEL[row.grade ?? "none"] ?? row.grade ?? "-"
        ])}
      />
      {rows.length > 50 ? (
        <p className="mt-2 text-xs text-slate-500">등급 미리보기는 상위 50행만 표시합니다.</p>
      ) : null}
    </div>
  );
}

function PartnerMasterPreviewTable({
  items,
  loading
}: {
  items: PartnerMasterAnalysisItem[];
  loading: boolean;
}) {
  if (loading) return <LoadingMessage message="파트너 기본정보 미리보기를 생성 중입니다." />;
  if (items.length === 0) return <EmptyMessage message="미리보기 결과가 없습니다." />;

  return (
    <PreviewTable
      headers={[
        "행",
        "파트너번호",
        "회사명",
        "사업자번호",
        "처리",
        "사유",
        "변경 필드",
        "주의"
      ]}
      rows={items.map((item) => [
        String(item.row_number),
        item.external_no ?? "-",
        item.company_name,
        item.business_number ?? "-",
        PARTNER_MASTER_ACTION_LABEL[item.action] ?? item.action,
        item.reason,
        item.changed_fields.join(", ") || "-",
        item.warnings?.join(" ") || "-"
      ])}
    />
  );
}

function PartnerContactsPreviewTable({
  items,
  loading
}: {
  items: PartnerContactsAnalysisItem[];
  loading: boolean;
}) {
  if (loading) return <LoadingMessage message="담당자 업로드 미리보기를 생성 중입니다." />;
  if (items.length === 0) return <EmptyMessage message="미리보기 결과가 없습니다." />;

  return (
    <PreviewTable
      headers={[
        "row_number",
        "partner_no",
        "company_name",
        "contact_name",
        "role_raw",
        "department",
        "position",
        "phone",
        "email",
        "계약담당자",
        "action",
        "reason",
        "matched_partner_name"
      ]}
      rows={items.map((item) => [
        String(item.row_number),
        item.partner_no ?? "-",
        item.company_name,
        item.contact_name || "-",
        item.role_raw ?? "-",
        item.department ?? "-",
        item.position ?? "-",
        item.phone ?? "-",
        item.email ?? "-",
        item.is_contract_contact ? "O" : "-",
        PARTNER_CONTACTS_ACTION_LABEL[item.action],
        item.reason,
        item.matched_partner_name ?? "-"
      ])}
    />
  );
}

function PartnerEquipmentPreviewTable({
  items,
  loading
}: {
  items: PartnerEquipmentAnalysisItem[];
  loading: boolean;
}) {
  if (loading) return <LoadingMessage message="장비 업로드 미리보기를 생성 중입니다." />;
  if (items.length === 0) return <EmptyMessage message="미리보기 결과가 없습니다." />;

  return (
    <PreviewTable
      headers={[
        "파트너사",
        "매칭 결과",
        "노드명",
        "CPU",
        "Memory",
        "OS Disk",
        "Ceph Disk",
        "NIC",
        "상태",
        "비고",
        "ACTION",
        "REASON"
      ]}
      rows={items.map((item) => [
        item.company_name,
        item.matched_partner_name ?? "-",
        item.node_name ?? "-",
        item.cpu ?? "-",
        item.memory ?? "-",
        item.os_disk ?? "-",
        item.ceph_disk ?? "-",
        item.nic ?? "-",
        item.asset_status ?? "-",
        item.memo ?? "-",
        item.action,
        item.reason
      ])}
    />
  );
}

function TrainingAttendancePreviewTable({
  items,
  loading
}: {
  items: TrainingAttendancePreviewItem[];
  loading: boolean;
}) {
  if (loading) return <LoadingMessage message="정기교육 참석자 미리보기를 생성 중입니다." />;
  if (items.length === 0) return <EmptyMessage message="미리보기 결과가 없습니다." />;

  return (
    <PreviewTable
      headers={[
        "row_number",
        "company_name",
        "attendee_name",
        "training_name",
        "start_date",
        "action",
        "reason",
        "matched_partner_name",
        "matched_training_name"
      ]}
      rows={items.map((item) => [
        String(item.row_number),
        item.company_name,
        item.attendee_name,
        item.training_name,
        item.start_date,
        item.action,
        item.reason,
        item.matched_partner_name ?? "-",
        item.matched_training_name ?? "-"
      ])}
    />
  );
}

function PartnerTrainingPreviewTable({ rows }: { rows: ParsedPartnerRow[] }) {
  if (rows.length === 0) return <EmptyMessage message="미리보기 결과가 없습니다." />;

  return (
    <PreviewTable
      headers={[
        "company_name",
        "grade",
        "contract_start_date",
        "primary_email",
        "has_training",
        "theory_only",
        "has_sales_opportunity"
      ]}
      rows={rows.slice(0, 30).map((row) => [
        row.company_name,
        row.grade,
        row.contract_start_date ?? "-",
        row.primary_email ?? "-",
        row.has_training ? "O" : "-",
        row.theory_only ? "O" : "-",
        row.has_sales_opportunity ? "O" : "-"
      ])}
    />
  );
}

function GenericPreviewTable({ preview }: { preview: GenericPreview }) {
  if (preview.rows.length === 0) return <EmptyMessage message="미리보기 결과가 없습니다." />;

  return (
    <PreviewTable
      headers={preview.headers}
      rows={preview.rows.map((row) => preview.headers.map((header) => row[header] ?? "-"))}
    />
  );
}

function PreviewTable({
  headers,
  rows
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row[0] ?? "row"}`} className="hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-sm text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrainingAttendanceDebugPanel({
  result
}: {
  result: TrainingAttendanceParseResult;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-900">파싱 디버그 (정기교육 참석자)</div>
      <div className="space-y-2 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-700">시트 목록:</span>{" "}
          {result.sheet_names.join(", ") || "-"}
        </div>
        <div>
          <span className="font-semibold text-slate-700">선택 시트:</span> {result.sheet_name}
        </div>
        <div>
          <span className="font-semibold text-slate-700">헤더:</span>{" "}
          {result.headers.filter((h) => !h.startsWith("col_")).join(", ") || "-"}
        </div>
        <div>
          <span className="font-semibold text-slate-700">컬럼 매핑:</span>
          <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-700">
            {JSON.stringify(result.column_mapping, null, 2)}
          </pre>
        </div>
        {result.sample_row ? (
          <div>
            <span className="font-semibold text-slate-700">샘플 행:</span>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-700">
              {JSON.stringify(result.sample_row, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReviewList({
  rows
}: {
  rows: Array<{ key: string; title: string; description: string }>;
}) {
  if (rows.length === 0) return <EmptyMessage message="확인필요 항목이 없습니다." />;

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900">{row.title}</div>
          <div className="mt-1 text-sm text-amber-700">{row.description}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingMessage({ message }: { message: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
      <Loader2 size={16} className="animate-spin" />
      {message}
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function buildGenericPreview(workbook: XLSX.WorkBook): GenericPreview {
  const selectedSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    sheetNames: workbook.SheetNames,
    selectedSheet,
    totalRows: rows.length,
    headers,
    rows: rows.slice(0, 20).map((row) =>
      headers.reduce<Record<string, string>>((acc, header) => {
        acc[header] = normalizeCell(row[header]);
        return acc;
      }, {})
    )
  };
}

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}





