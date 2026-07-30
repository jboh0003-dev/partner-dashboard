import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateLookupPassword(): string {
  return randomBytes(5).toString("hex");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function verifySecret(value: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(value), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateApplicationNumber(now = new Date()): string {
  const y = now.getFullYear();
  const seq = randomBytes(3).toString("hex").toUpperCase();
  return `PA-${y}-${seq}`;
}
