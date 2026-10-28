import 'server-only';
import { createHash } from 'node:crypto';
import { database } from './database';

export function blobCredentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = token?.split('_')[3];
  if (!token || !storeId || !/^[a-z0-9]+$/i.test(storeId)) throw new Error('PRIVATE_STORE_NOT_CONFIGURED');
  return { token, storeId };
}

export function validatePrivateBlobUrl(raw: string, id: string, sha: string) {
  const { storeId } = blobCredentials();
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== `${storeId}.private.blob.vercel-storage.com`.toLowerCase() || url.pathname !== `/documents/${id}/${sha}` || url.search || url.hash) throw new Error('PRIVATE_DOCUMENT_URL_INVALID');
  return url.toString();
}

export async function readPrivateBlob(raw: string, id: string, sha: string) {
  const url = validatePrivateBlobUrl(raw, id, sha);
  const { token } = blobCredentials();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`PRIVATE_DOCUMENT_READ_${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (createHash('sha256').update(data).digest('hex') !== sha) throw new Error('PRIVATE_DOCUMENT_HASH_MISMATCH');
  return new Blob([data], { type: response.headers.get('content-type') || 'application/octet-stream' });
}

export async function readArchivedDocument(id: string, sourcePath: string | null) {
  if (!sourcePath || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  const rows = await database()`select sha256,url from connect_recovery_private.document_blob_backups where document_id=${id}::uuid and source_path=${sourcePath}`;
  if (!rows.length) return null;
  return readPrivateBlob(String(rows[0].url), id, String(rows[0].sha256));
}
