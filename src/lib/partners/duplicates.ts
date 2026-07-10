import {
  filterActivePartnerMasterRows,
  type PartnerMasterDbRow
} from "@/lib/imports/partner-master";
import {
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizePartnerNo
} from "@/lib/partner-match";

export type DuplicatePartnerEntry = {
  id: string;
  company_name: string;
  external_no: string | null;
  business_number: string | null;
};

export type DuplicatePartnerGroup = {
  key: string;
  kind: "partner_no" | "business_number" | "company_name";
  partners: DuplicatePartnerEntry[];
};

export type PartnerDuplicateReport = {
  partner_no: DuplicatePartnerGroup[];
  business_number: DuplicatePartnerGroup[];
  company_name: DuplicatePartnerGroup[];
  total_groups: number;
};

function groupByKey(
  partners: PartnerMasterDbRow[],
  kind: DuplicatePartnerGroup["kind"],
  getKey: (partner: PartnerMasterDbRow) => string | null
): DuplicatePartnerGroup[] {
  const buckets = new Map<string, DuplicatePartnerEntry[]>();

  for (const partner of partners) {
    const key = getKey(partner);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push({
      id: partner.id,
      company_name: partner.company_name,
      external_no: partner.external_no ?? null,
      business_number: partner.business_number ?? null
    });
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => ({ key, kind, partners: entries }))
    .sort((left, right) => right.partners.length - left.partners.length);
}

export function findPartnerDuplicateGroups(
  partners: PartnerMasterDbRow[]
): PartnerDuplicateReport {
  const active = filterActivePartnerMasterRows(partners);

  const partner_no = groupByKey(active, "partner_no", (partner) =>
    normalizePartnerNo(partner.external_no)
  );
  const business_number = groupByKey(active, "business_number", (partner) =>
    normalizeBusinessNumber(partner.business_number)
  );
  const company_name = groupByKey(active, "company_name", (partner) =>
    normalizeCompanyName(partner.company_name)
  );

  return {
    partner_no,
    business_number,
    company_name,
    total_groups: partner_no.length + business_number.length + company_name.length
  };
}
