import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cloud synchronization is temporarily disabled during the Supabase quota
// restriction. Never expose or overwrite the owner's saved state without
// authenticating the caller.
const disabled = () =>
  NextResponse.json(
    { ok: false, message: "클라우드 동기화가 일시 중단되었습니다. 브라우저 로컬 모드를 사용해주세요." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
