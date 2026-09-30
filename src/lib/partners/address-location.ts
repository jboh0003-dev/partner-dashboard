export type PartnerAddressLocation = {
  primaryAddress: string;
  regionGroup: string;
  region: string;
  city: string;
};

type RegionRule = {
  prefix: RegExp;
  regionGroup: string;
  region: string;
  kind: "metro" | "province" | "sejong";
};

const REGION_RULES: RegionRule[] = [
  {
    prefix: /^(?:서울특별시|서울시|서울)(?:\s|$)/,
    regionGroup: "수도권",
    region: "서울",
    kind: "metro"
  },
  {
    prefix: /^(?:경기도|경기)(?:\s|$)/,
    regionGroup: "수도권",
    region: "경기",
    kind: "province"
  },
  {
    prefix: /^(?:인천광역시|인천시|인천)(?:\s|$)/,
    regionGroup: "수도권",
    region: "인천",
    kind: "metro"
  },
  {
    prefix: /^(?:부산광역시|부산시|부산)(?:\s|$)/,
    regionGroup: "영남권",
    region: "부산",
    kind: "metro"
  },
  {
    prefix: /^(?:대구광역시|대구시|대구)(?:\s|$)/,
    regionGroup: "영남권",
    region: "대구",
    kind: "metro"
  },
  {
    prefix: /^(?:울산광역시|울산시|울산)(?:\s|$)/,
    regionGroup: "영남권",
    region: "울산",
    kind: "metro"
  },
  {
    prefix: /^(?:경상남도|경남)(?:\s|$)/,
    regionGroup: "영남권",
    region: "경남",
    kind: "province"
  },
  {
    prefix: /^(?:경상북도|경북)(?:\s|$)/,
    regionGroup: "영남권",
    region: "경북",
    kind: "province"
  },
  {
    prefix: /^(?:대전광역시|대전시|대전)(?:\s|$)/,
    regionGroup: "중부권",
    region: "대전",
    kind: "metro"
  },
  {
    prefix: /^(?:세종특별자치시|세종시|세종)(?:\s|$)/,
    regionGroup: "중부권",
    region: "세종",
    kind: "sejong"
  },
  {
    prefix: /^(?:충청북도|충북)(?:\s|$)/,
    regionGroup: "중부권",
    region: "충북",
    kind: "province"
  },
  {
    prefix: /^(?:충청남도|충남)(?:\s|$)/,
    regionGroup: "중부권",
    region: "충남",
    kind: "province"
  },
  {
    prefix: /^(?:강원특별자치도|강원도|강원)(?:\s|$)/,
    regionGroup: "중부권",
    region: "강원",
    kind: "province"
  },
  {
    prefix: /^(?:광주광역시|광주시|광주)(?:\s|$)/,
    regionGroup: "중부권",
    region: "광주",
    kind: "metro"
  },
  {
    prefix: /^(?:전북특별자치도|전라북도|전북)(?:\s|$)/,
    regionGroup: "중부권",
    region: "전북",
    kind: "province"
  },
  {
    prefix: /^(?:전라남도|전남)(?:\s|$)/,
    regionGroup: "중부권",
    region: "전남",
    kind: "province"
  },
  {
    prefix: /^(?:제주특별자치도|제주도|제주)(?:\s|$)/,
    regionGroup: "중부권",
    region: "제주",
    kind: "province"
  }
];

const OFFICE_LABEL =
  /^(?:본사(?:\s*주소)?|본점(?:\s*소재지)?|본점소재지|주소|소재지|(?:[가-힣]{1,12}\s*)?사무소|(?:[가-힣]{1,12}\s*)?지사|(?:[가-힣]{1,12}\s*)?지점)\s*[:：-]\s*/;

const HEADQUARTERS_LABEL =
  /^\*?\s*(?:본사(?:\s*주소)?|본점(?:\s*소재지)?|본점소재지)\s*[:：-]/;

function normalizeAddressText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}

function addressCandidates(value: unknown): string[] {
  const normalized = normalizeAddressText(value)
    .replace(
      /[ \t]+\*(?=\s*(?:본사(?:\s*주소)?|본점(?:\s*소재지)?|본점소재지|(?:[가-힣]{1,12}\s*)?사무소|(?:[가-힣]{1,12}\s*)?지사|(?:[가-힣]{1,12}\s*)?지점)\s*[:：-])/g,
      "\n*"
    );

  return normalized
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripOfficeLabel(value: string): string {
  return value.replace(/^\*?\s*/, "").replace(OFFICE_LABEL, "").trim();
}

export function selectPrimaryPartnerAddress(value: unknown): string {
  const candidates = addressCandidates(value);
  if (candidates.length === 0) return "";

  const selected =
    candidates.find((candidate) => HEADQUARTERS_LABEL.test(candidate)) ??
    candidates[0];

  return stripOfficeLabel(selected);
}

function normalizeCity(value: string): string {
  return value.replace(/특례시$/, "시");
}

function inferCity(rest: string, rule: RegionRule): string {
  if (rule.kind === "sejong") {
    return "세종시";
  }

  if (rule.kind === "metro") {
    const district = rest.match(/^([가-힣]+(?:구|군))(?=\s|$|,|\()/)?.[1];
    if (district) return district;
    const city = rest.match(/^([가-힣]+(?:특례시|시))(?=\s|$|,|\()/)?.[1];
    return city ? normalizeCity(city) : "";
  }

  const municipality = rest.match(/^([가-힣]+(?:특례시|시|군))(?=\s|$|,|\()/)?.[1];
  if (municipality) return normalizeCity(municipality);

  const fallback = rest.match(/(?:^|\s)([가-힣]+(?:특례시|시|군|구))(?=\s|$|,|\()/)?.[1];
  return fallback ? normalizeCity(fallback) : "";
}

export function inferPartnerAddressLocation(value: unknown): PartnerAddressLocation {
  const primaryAddress = selectPrimaryPartnerAddress(value);
  if (!primaryAddress) {
    return {
      primaryAddress: "",
      regionGroup: "",
      region: "",
      city: ""
    };
  }

  const normalizedPrimary = primaryAddress
    .replace(/^\(?\d{5}\)?\s*/, "")
    .trim();

  const rule = REGION_RULES.find((candidate) => candidate.prefix.test(normalizedPrimary));
  if (!rule) {
    return {
      primaryAddress,
      regionGroup: "",
      region: "",
      city: ""
    };
  }

  const rest = normalizedPrimary.replace(rule.prefix, "").trim();

  return {
    primaryAddress,
    regionGroup: rule.regionGroup,
    region: rule.region,
    city: inferCity(rest, rule)
  };
}
