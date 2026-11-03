import { PartnerDocumentPreviewClient } from "@/components/documents/partner-document-preview-client";

export const dynamic = "force-dynamic";

export default async function PartnerDocumentPreviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PartnerDocumentPreviewClient documentId={id} />;
}
