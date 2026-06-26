import Link from "next/link";
import { PageHero } from "@/components/layout/page-hero";
import { PolicyView } from "@/components/policy/policy-view";
import { fetchPolicyBundle } from "@/lib/data/partner-policy";
import {
  PARTNER_POLICY_PPT_FILENAME,
  PARTNER_POLICY_PPT_PATH,
  PARTNER_POLICY_SECTIONS,
  PARTNER_POLICY_UPDATED_AT
} from "@/lib/policy/partner-policy";
import { PolicyFallbackView } from "@/components/policy/policy-fallback-view";

export const dynamic = "force-dynamic";

export default async function PartnerPolicyPage({
  searchParams
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  const { version } = await searchParams;
  const bundle = await fetchPolicyBundle(version);

  return (
    <>
      <PageHero
        title="파트너 정책 / 가이드"
        description="파트너 등급, 혜택, 교육, PoC, 계약 서류 기준을 한곳에서 확인합니다."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/policy/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              정책 업로드
            </Link>
            {bundle.current ? (
              <a
                href={`/api/policy/documents/${bundle.current.id}/download`}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                원본 다운로드
              </a>
            ) : (
              <a
                href={PARTNER_POLICY_PPT_PATH}
                download={PARTNER_POLICY_PPT_FILENAME}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                내장 PPT 다운로드
              </a>
            )}
          </div>
        }
      />

      {bundle.current ? (
        <PolicyView current={bundle.current} versions={bundle.versions} chunks={bundle.chunks} />
      ) : (
        <PolicyFallbackView
          sections={PARTNER_POLICY_SECTIONS}
          fileName={PARTNER_POLICY_PPT_FILENAME}
          updatedAt={PARTNER_POLICY_UPDATED_AT}
        />
      )}
    </>
  );
}
