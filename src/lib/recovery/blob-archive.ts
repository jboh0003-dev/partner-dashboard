import 'server-only';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { database, recoveryEnabled } from './database';
import { blobCredentials, readPrivateBlob, validatePrivateBlobUrl } from './blob-storage';
import { getDocumentContentType } from '@/lib/documents/display';

let running = false;
export async function archiveRecoveryDocuments(request: NextRequest) {
  // This deployment URL is protected by the project's existing Vercel Authentication.
  // Public production aliases are rejected, even for signed-in app users.
  const deploymentHost = process.env.VERCEL_URL;
  if (!recoveryEnabled() || process.env.CONNECT_BLOB_ARCHIVE_ENABLED !== 'true' || Date.now() > Number(process.env.CONNECT_BLOB_MAINTENANCE_UNTIL || '0') || !deploymentHost || request.headers.get('host') !== deploymentHost || request.nextUrl.hostname !== deploymentHost) return new NextResponse(null, { status: 404 });
  if (running) return NextResponse.json({ retry: true }, { status: 409 });
  running = true;
  const completed: string[] = [];
  const errors: Array<{ id: string; code: string }> = [];
  const started = Date.now();
  try {
    const db = database();
    const { token, storeId } = blobCredentials();
    const existing = await db`select coalesce(sum(byte_size),0)::bigint as bytes from connect_recovery_private.document_blob_backups`;
    let storedBytes = Number(existing[0].bytes);
    const candidates = await db.unsafe(`
      select b.document_id as id,b.sha256,'backup' as source from connect_recovery_private.document_backups b
      left join connect_recovery_private.document_blob_backups m on m.document_id=b.document_id and m.sha256=b.sha256
      where m.document_id is null
      union all
      select c.document_id as id,c.sha256,'staging' as source from connect_recovery_private.document_chunks c
      left join connect_recovery_private.document_blob_backups m on m.document_id=c.document_id and m.sha256=c.sha256
      where m.document_id is null
      group by c.document_id,c.sha256
      having count(*)=min(c.total) and min(c.total)=max(c.total) and min(c.part)=0 and max(c.part)=min(c.total)-1
      limit 15`);
    for (const candidate of candidates) {
      if (Date.now() - started > 180000) break;
      const id = String(candidate.id), sha = String(candidate.sha256);
      try {
        const documents = await db`select id,storage_path,file_path,original_filename,file_name,file_ext,document_type from public.partner_documents where id=${id}::uuid and deleted_at is null and is_active is not false`;
        if (!documents.length) continue;
        const already = await db`select 1 from connect_recovery_private.document_blob_backups where document_id=${id}::uuid and sha256=${sha}`;
        if (already.length) continue;
        const document = documents[0];
        const sourcePath = document.storage_path || document.file_path;
        if (!sourcePath) continue;
        const bodyRows = candidate.source === 'backup'
          ? await db`select content as data from connect_recovery_private.document_backups where document_id=${id}::uuid and sha256=${sha}`
          : await db`select decode(string_agg(encode(content,'hex'),'' order by part),'hex') as data from connect_recovery_private.document_chunks where document_id=${id}::uuid and sha256=${sha}`;
        if (!bodyRows[0]?.data) continue;
        const data = new Uint8Array(bodyRows[0].data);
        if (createHash('sha256').update(data).digest('hex') !== sha) throw new Error('SOURCE_HASH_MISMATCH');
        if (storedBytes + data.byteLength > 900000000) throw new Error('FREE_STORAGE_BUDGET_REACHED');
        const pathname = `documents/${id}/${sha}`;
        const response = await fetch(`https://vercel.com/api/blob/?${new URLSearchParams({ pathname })}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'x-api-version': '13', 'x-vercel-blob-store-id': storeId, 'x-vercel-blob-access': 'private', 'x-add-random-suffix': '0', 'x-allow-overwrite': '1', 'x-content-type': getDocumentContentType(document), 'x-cache-control-max-age': '60' },
          body: new Blob([data]), signal: AbortSignal.timeout(120000)
        });
        if (!response.ok) throw new Error(`PRIVATE_DOCUMENT_UPLOAD_${response.status}`);
        const result = await response.json() as { url?: string };
        if (!result.url) throw new Error('PRIVATE_DOCUMENT_URL_MISSING');
        const url = validatePrivateBlobUrl(result.url, id, sha);
        const verified = await readPrivateBlob(url, id, sha);
        if (verified.size !== data.byteLength) throw new Error('PRIVATE_DOCUMENT_SIZE_MISMATCH');
        await db.begin('read write', async tx => {
          await tx`insert into connect_recovery_private.document_blob_backups(document_id,sha256,url,source_path,byte_size) values(${id}::uuid,${sha},${url},${String(sourcePath)},${data.byteLength}) on conflict(document_id) do update set sha256=excluded.sha256,url=excluded.url,source_path=excluded.source_path,byte_size=excluded.byte_size`;
          await tx`delete from connect_recovery_private.document_chunks where document_id=${id}::uuid and sha256=${sha}`;
        });
        storedBytes += data.byteLength;
        completed.push(id);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'ARCHIVE_FAILED';
        console.error('Private document archive failed', id, code);
        errors.push({ id, code });
      }
    }
    return NextResponse.json({ completed, errors, storedBytes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Private document archive unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ completed, errors, code: 'ARCHIVE_UNAVAILABLE' }, { status: 503 });
  } finally { running = false; }
}
