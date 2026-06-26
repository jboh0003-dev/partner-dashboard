import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNER_POLICY_BUCKET } from "@/lib/policy/constants";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "@/types/partner-policy";

function mapDocument(row: Record<string, unknown>): PartnerPolicyDocument {
  return {
    id: String(row.id),
    policy_title: String(row.policy_title),
    version_label: String(row.version_label),
    effective_date: String(row.effective_date),
    source_file_name: String(row.source_file_name),
    storage_path: String(row.storage_path),
    file_type: String(row.file_type),
    file_size: row.file_size != null ? Number(row.file_size) : null,
    description: row.description ? String(row.description) : null,
    change_memo: row.change_memo ? String(row.change_memo) : null,
    is_current: Boolean(row.is_current),
    status: String(row.status),
    uploaded_by: row.uploaded_by ? String(row.uploaded_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapChunk(row: Record<string, unknown>): PartnerPolicyChunk {
  return {
    id: String(row.id),
    policy_document_id: String(row.policy_document_id),
    section_title: row.section_title ? String(row.section_title) : null,
    category: row.category ? String(row.category) : null,
    slide_number: row.slide_number != null ? Number(row.slide_number) : null,
    page_number: row.page_number != null ? Number(row.page_number) : null,
    content: String(row.content),
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : null,
    raw_json: (row.raw_json as Record<string, unknown> | null) ?? null,
    created_at: String(row.created_at)
  };
}

export async function fetchCurrentPolicyDocument(): Promise<PartnerPolicyDocument | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_policy_documents")
    .select("*")
    .eq("is_current", true)
    .eq("status", "active")
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapDocument(data as Record<string, unknown>) : null;
}

export async function fetchPolicyDocumentVersions(): Promise<PartnerPolicyDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_policy_documents")
    .select("*")
    .eq("status", "active")
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => mapDocument(row as Record<string, unknown>));
}

export async function fetchPolicyChunks(documentId: string): Promise<PartnerPolicyChunk[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_policy_chunks")
    .select("*")
    .eq("policy_document_id", documentId)
    .order("slide_number", { ascending: true });

  return (data ?? []).map((row) => mapChunk(row as Record<string, unknown>));
}

export async function fetchPolicyBundle(documentId?: string) {
  const current = documentId
    ? (await fetchPolicyDocumentVersions()).find((doc) => doc.id === documentId) ?? null
    : await fetchCurrentPolicyDocument();

  if (!current) {
    return { current: null, versions: await fetchPolicyDocumentVersions(), chunks: [] as PartnerPolicyChunk[] };
  }

  const [versions, chunks] = await Promise.all([
    fetchPolicyDocumentVersions(),
    fetchPolicyChunks(current.id)
  ]);

  return { current, versions, chunks };
}

export async function createPolicyDownloadUrl(storagePath: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PARTNER_POLICY_BUCKET)
    .createSignedUrl(storagePath, 60 * 30);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function fetchCurrentPolicyChunksForSearch(): Promise<{
  document: PartnerPolicyDocument | null;
  chunks: PartnerPolicyChunk[];
}> {
  const current = await fetchCurrentPolicyDocument();
  if (!current) return { document: null, chunks: [] };
  const chunks = await fetchPolicyChunks(current.id);
  return { document: current, chunks };
}
