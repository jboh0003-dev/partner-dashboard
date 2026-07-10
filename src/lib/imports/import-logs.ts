import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMP_IMPORTS_BUCKET = "temp-imports";

export type ImportLogInput = {
  import_type: string;
  original_filename: string;
  uploaded_by?: string | null;
  total_rows: number;
  success_count: number;
  failed_count: number;
  review_count: number;
  merge_count: number;
  excluded_count: number;
  storage_file_deleted?: boolean;
  storage_path?: string | null;
  status: "success" | "failed" | "partial_success";
  error_message?: string | null;
  import_job_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeImportLog(
  supabase: SupabaseClient,
  input: ImportLogInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("import_logs")
    .insert({
      import_type: input.import_type,
      original_filename: input.original_filename,
      uploaded_by: input.uploaded_by ?? null,
      total_rows: input.total_rows,
      success_count: input.success_count,
      failed_count: input.failed_count,
      review_count: input.review_count,
      merge_count: input.merge_count,
      excluded_count: input.excluded_count,
      storage_file_deleted: input.storage_file_deleted ?? false,
      storage_path: input.storage_path ?? null,
      status: input.status,
      error_message: input.error_message ?? null,
      import_job_id: input.import_job_id ?? null,
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single();

  if (error) {
    console.error("[import_logs] write failed:", error.message);
    return null;
  }
  return data?.id as string;
}

export async function ensureTempImportsBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(listError.message);

  if (buckets?.some((bucket) => bucket.name === TEMP_IMPORTS_BUCKET || bucket.id === TEMP_IMPORTS_BUCKET)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(TEMP_IMPORTS_BUCKET, {
    public: false
  });
  if (createError && !createError.message.includes("already exists")) {
    throw new Error(createError.message);
  }
}

export async function uploadTempImportFile(
  supabase: SupabaseClient,
  file: File | Uint8Array,
  originalFilename: string,
  importType: string
): Promise<string> {
  await ensureTempImportsBucket(supabase);
  const safeName = originalFilename.replace(/[^\w.\-가-힣]/g, "_");
  const storagePath = `${importType}/${Date.now()}_${safeName}`;
  const body =
    file instanceof Uint8Array && !(file instanceof File)
      ? file
      : Buffer.from(await (file as File).arrayBuffer());

  const { error } = await supabase.storage.from(TEMP_IMPORTS_BUCKET).upload(storagePath, body, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false
  });
  if (error) throw new Error(error.message);
  return storagePath;
}

export async function deleteTempImportFile(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<boolean> {
  if (!storagePath?.trim()) return false;
  const { error } = await supabase.storage.from(TEMP_IMPORTS_BUCKET).remove([storagePath]);
  return !error;
}
