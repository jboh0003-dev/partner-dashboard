/**
 * Scan the entire PDF byte stream for detached or in-document signature
 * dictionaries. A signature can occur well beyond the first megabyte.
 * False positives only disable optimization; they never modify the file.
 */
export function hasPdfDigitalSignature(bytes: Uint8Array): boolean {
  const decoder = new TextDecoder("latin1");
  const chunkSize = 128 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const windowStart = Math.max(0, offset - 256);
    const chunk = decoder.decode(
      bytes.subarray(windowStart, Math.min(bytes.length, offset + chunkSize))
    );
    if (/\/ByteRange\s*\[|\/Type\s*\/Sig\b|\/SubFilter\s*\/adbe\.pkcs7/i.test(chunk)) {
      return true;
    }
  }
  return false;
}
