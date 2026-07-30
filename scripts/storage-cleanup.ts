/**
 * 승인된 manifest의 Storage 파일만 삭제 (Storage API remove)
 * 실행: npm run storage:cleanup -- --manifest=scripts/output/storage-cleanup-candidates-....json
 * CONFIRM_DELETE=true 필수
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PARTNER_DOCUMENTS_BUCKET } from "../src/lib/documents/constants";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function getManifestPath(): string {
  const arg = process.argv.find((a) => a.startsWith("--manifest="));
  if (!arg) {
    throw new Error("--manifest=<path> 필요");
  }
  return resolve(process.cwd(), arg.slice("--manifest=".length));
}

async function main() {
  loadEnvLocal();
  if (process.env.CONFIRM_DELETE !== "true") {
    console.error("거부됨: CONFIRM_DELETE=true 일 때만 삭제합니다. (dry-run은 storage:audit 사용)");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env 필요");

  const manifestPath = getManifestPath();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    bucket?: string;
    paths?: string[];
  };
  const paths = (manifest.paths ?? []).filter(Boolean);
  if (paths.length === 0) {
    console.log("삭제할 path 없음");
    return;
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const bucket = manifest.bucket || PARTNER_DOCUMENTS_BUCKET;

  const results: Array<{ path: string; ok: boolean; error?: string }> = [];
  const batchSize = 50;

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      for (const path of batch) {
        results.push({ path, ok: false, error: error.message });
      }
      console.error("배치 삭제 실패, 중단:", error.message);
      break;
    }
    for (const path of batch) {
      results.push({ path, ok: true });
      // 성공한 path의 DB 레코드는 soft-mark만 (hard delete 금지)
      await supabase
        .from("partner_documents")
        .update({
          is_duplicate: true,
          duplicate_reason: "storage_cleanup_exact_duplicate",
          is_active: false,
          note: "storage cleanup: exact duplicate removed via Storage API"
        })
        .or(`storage_path.eq.${path},file_path.eq.${path}`);
    }
  }

  const outDir = resolve(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `storage-cleanup-result-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ results }, null, 2), "utf8");
  console.log(
    `done: ok=${results.filter((r) => r.ok).length} fail=${results.filter((r) => !r.ok).length}`
  );
  console.log("wrote", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
