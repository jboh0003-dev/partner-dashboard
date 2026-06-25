import { PARTNER_STATUS_LABEL } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status?: string | null }) {
  const label = status ? PARTNER_STATUS_LABEL[status] ?? status : "미지정";

  return <Badge tone="neutral">{label}</Badge>;
}
