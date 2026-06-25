import { buildAutoDisplayName } from "@/lib/documents/display";
import {
  evaluateExistingDocumentMatch,
  matchDocumentPartner
} from "@/lib/documents/document-matching";
import { extractFolderPartnerHintFromPath } from "@/lib/documents/folder-parser";
import { parseFilenameMetadata, findPartnerNamesMentionedInFilename } from "@/lib/documents/filename-parser";
import type { DocumentMatchMethod } from "@/lib/documents/constants";

export type ReinspectPartnerRow = {
  id: string;
  company_name: string;
  external_no: string | null;
};

export type ReinspectDocumentRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  original_filename: string | null;
  file_name: string;
  source_folder: string | null;
  source_file: string | null;
  document_type: string | null;
  display_name: string | null;
  contract_date: string | null;
  grade_from_file: string | null;
  partner_no: string | null;
  partner_name_raw: string | null;
  match_method: string | null;
  match_confidence: number | null;
};

export type ReinspectUpdatePayload = {
  id: string;
  document_type: string;
  display_name: string;
  extracted_partner_name: string | null;
  contract_date: string | null;
  grade_from_file: string | null;
  match_status: string;
  match_confidence: number;
  match_method: string | null;
  review_status: string;
  partner_name_raw: string | null;
};

export function buildDocumentReinspectUpdate(
  doc: ReinspectDocumentRow,
  partners: ReinspectPartnerRow[]
): ReinspectUpdatePayload {
  const originalFilename = doc.original_filename ?? doc.file_name;
  const sourceFolder = doc.source_folder ?? "";
  const relativePath = doc.source_file ?? originalFilename;
  const folderHint = extractFolderPartnerHintFromPath(relativePath, sourceFolder);
  const parsed = parseFilenameMetadata(originalFilename, {
    relativePath
  });

  const folderPartnerName = folderHint?.primary ?? null;
  const extractedName =
    folderPartnerName ?? parsed.extracted_partner_name ?? doc.partner_name_raw;
  const linkedPartner = partners.find((partner) => partner.id === doc.partner_id) ?? null;
  const partnerCompanyName = linkedPartner?.company_name ?? doc.partner_name;

  let matchStatus = "matched";
  let matchConfidence = 90;
  let matchMethod: DocumentMatchMethod | null =
    (doc.match_method as DocumentMatchMethod | null) ?? null;
  let reviewStatus = "auto_matched";

  if (doc.match_method === "manual" || doc.match_method === "folder") {
    matchStatus = "matched";
    matchConfidence = doc.match_confidence ?? 100;
    matchMethod = doc.match_method as DocumentMatchMethod;
    reviewStatus = "auto_matched";
  } else {
    const evaluation = evaluateExistingDocumentMatch({
      extractedPartnerName: extractedName,
      partnerCompanyName,
      matchConfidence: doc.match_confidence,
      matchMethod: doc.match_method
    });
    matchStatus = evaluation.match_status;
    matchConfidence = evaluation.match_confidence;
    reviewStatus = evaluation.match_status === "matched" ? "auto_matched" : "needs_review";

    if (evaluation.match_status === "needs_review" && extractedName) {
      const suggestion = matchDocumentPartner({
        folderCandidates: folderHint?.is_generic_folder ? [] : (folderHint?.match_candidates ?? []),
        folderNormalizedName: folderHint?.normalized_name ?? null,
        isGenericFolder: folderHint?.is_generic_folder ?? false,
        filenamePartnerName: parsed.extracted_partner_name,
        filenameCandidates: [
          ...parsed.filename_partner_candidates,
          ...findPartnerNamesMentionedInFilename(originalFilename, partners)
        ],
        sourceFolderName: folderHint?.source_folder_name ?? null,
        partnerNo: parsed.partner_no ?? doc.partner_no,
        partners
      });
      if (suggestion.match_method) {
        matchMethod = suggestion.match_method;
      }
      if (suggestion.match_confidence > matchConfidence) {
        matchConfidence = suggestion.match_confidence;
      }
    }
  }

  return {
    id: doc.id,
    document_type: parsed.document_type,
    display_name: buildAutoDisplayName({
      document_type: parsed.document_type,
      original_filename: originalFilename
    }),
    extracted_partner_name: extractedName,
    contract_date: parsed.contract_date ?? doc.contract_date,
    grade_from_file: parsed.grade_from_file ?? doc.grade_from_file,
    match_status: matchStatus,
    match_confidence: matchConfidence,
    match_method: matchMethod,
    review_status: reviewStatus,
    partner_name_raw: extractedName
  };
}
