import type { SupabaseClient } from "@supabase/supabase-js";

export type PipelineDuplicateMode = "replace" | "new_version";

export type ExistingPipelineSnapshot = {
  id: string;
  snapshot_date: string;
  source_file_name: string;
  version: number;
  uploaded_at: string;
  is_current: boolean;
};

export type SnapshotSummaryPayload = {
  total_pipeline_amount_million: number;
  total_pipeline_count: number;
  partner_pipeline_amount_million: number;
  partner_pipeline_count: number;
  new_total_pipeline_amount_million: number;
  new_total_pipeline_count: number;
  new_partner_pipeline_amount_million: number;
  new_partner_pipeline_count: number;
};

export async function findExistingPipelineSnapshots(
  supabase: SupabaseClient,
  snapshotDate: string,
  sourceFileName: string
): Promise<ExistingPipelineSnapshot[]> {
  const { data, error } = await supabase
    .from("partner_performance_snapshots")
    .select("id, snapshot_date, source_file_name, version, uploaded_at, is_current, created_at")
    .eq("snapshot_date", snapshotDate)
    .eq("source_file_name", sourceFileName)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    snapshot_date: String(row.snapshot_date),
    source_file_name: String(row.source_file_name),
    version: Number(row.version ?? 1),
    uploaded_at: String(row.uploaded_at ?? row.created_at ?? new Date().toISOString()),
    is_current: Boolean(row.is_current)
  }));
}

export async function refreshPipelineCurrentSnapshot(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from("partner_performance_snapshots")
    .select("id, snapshot_date, uploaded_at")
    .order("snapshot_date", { ascending: false })
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return null;

  const latestId = String(data.id);
  await supabase
    .from("partner_performance_snapshots")
    .update({ is_current: false })
    .eq("is_current", true);
  await supabase
    .from("partner_performance_snapshots")
    .update({ is_current: true })
    .eq("id", latestId);

  return latestId;
}

export async function resolvePipelineSnapshotSaveTarget(
  supabase: SupabaseClient,
  input: {
    snapshot_date: string;
    snapshot_label: string;
    source_file_name: string;
    duplicate_mode: PipelineDuplicateMode;
    summary: SnapshotSummaryPayload;
    uploaded_by?: string | null;
  }
): Promise<{ snapshotId: string; snapshotAction: "created" | "replaced" | "versioned"; version: number }> {
  const existing = await findExistingPipelineSnapshots(
    supabase,
    input.snapshot_date,
    input.source_file_name
  );
  const now = new Date().toISOString();

  const snapshotPayload = {
    snapshot_date: input.snapshot_date,
    snapshot_label: input.snapshot_label,
    source_file_name: input.source_file_name,
    total_pipeline_amount_million: input.summary.total_pipeline_amount_million,
    total_pipeline_count: input.summary.total_pipeline_count,
    partner_pipeline_amount_million: input.summary.partner_pipeline_amount_million,
    partner_pipeline_count: input.summary.partner_pipeline_count,
    new_total_pipeline_amount_million: input.summary.new_total_pipeline_amount_million,
    new_total_pipeline_count: input.summary.new_total_pipeline_count,
    new_partner_pipeline_amount_million: input.summary.new_partner_pipeline_amount_million,
    new_partner_pipeline_count: input.summary.new_partner_pipeline_count,
    uploaded_at: now,
    uploaded_by: input.uploaded_by ?? null,
    updated_at: now
  };

  if (existing.length > 0 && input.duplicate_mode === "replace") {
    const target = existing[0]!;
    const { error } = await supabase
      .from("partner_performance_snapshots")
      .update({ ...snapshotPayload, version: target.version })
      .eq("id", target.id);
    if (error) throw new Error(error.message);
    return {
      snapshotId: target.id,
      snapshotAction: "replaced",
      version: target.version
    };
  }

  const nextVersion =
    existing.length > 0 ? Math.max(...existing.map((row) => row.version)) + 1 : 1;

  const { data: created, error } = await supabase
    .from("partner_performance_snapshots")
    .insert({
      ...snapshotPayload,
      version: nextVersion,
      is_current: false
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "스냅샷 생성 실패");

  return {
    snapshotId: String(created.id),
    snapshotAction: existing.length > 0 ? "versioned" : "created",
    version: nextVersion
  };
}
