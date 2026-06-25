import * as XLSX from "xlsx";
import {
  COMPUTE_NODE_MATCH_PATTERN,
  normalizeNodeLabelForMatch
} from "@/lib/assets/node-utils";
import { normalizeCompanyName } from "@/lib/partner-match";

export const PARTNER_EQUIPMENT_BLOCK_SOURCE_FILE =
  "3. 기술파트너교육_ 교육생 관리대장(장비스펙).xlsx";

export type ParsedPartnerEquipmentRow = {
  row_number: number;
  excluded: boolean;
  excluded_reason: string | null;
  company_name: string;
  normalized_company_name: string | null;
  asset_group: string | null;
  node_type: string | null;
  node_name: string | null;
  form_factor: string | null;
  cpu: string | null;
  memory: string | null;
  os_disk: string | null;
  ceph_disk: string | null;
  nic: string | null;
  asset_status: string | null;
  asset_type: string | null;
  spec_summary: string | null;
  asset_name: string | null;
  vendor: string | null;
  model_name: string | null;
  quantity: number | null;
  memo: string | null;
  source_file: string;
  warnings: string[];
};

export type PartnerEquipmentParseResult = {
  sheet_name: string;
  layout: "block" | "vertical";
  total_rows: number;
  partner_count: number;
  excluded_count: number;
  warning_count: number;
  rows: ParsedPartnerEquipmentRow[];
  headers: string[];
};

const PREFERRED_SHEET = "파트너사별 장비규격";
const DEFAULT_ASSET_GROUP = "기술파트너 장비";

/** Excel 1-based row numbers where partner names appear in column A/E/I/M/Q */
const PARTNER_ANCHOR_ROWS = [23, 66, 113, 157];
/** A=0, E=4, I=8, M=12, Q=16 */
const BLOCK_START_COLS = [0, 4, 8, 12, 16];

const NODE_DEFINITIONS: Array<{ node_type: string; node_name: string; pattern: RegExp }> = [
  { node_type: "컨트롤 노드", node_name: "컨트롤 노드 1식", pattern: /컨트롤\s*노드\s*1\s*식/i },
  { node_type: "컨트롤 노드", node_name: "컨트롤 노드 2식", pattern: /컨트롤\s*노드\s*2\s*식/i },
  { node_type: "컨트롤 노드", node_name: "컨트롤 노드 3식", pattern: /컨트롤\s*노드\s*3\s*식/i },
  {
    node_type: "컴퓨트 노드",
    node_name: "컴퓨트 노드 1식",
    pattern: COMPUTE_NODE_MATCH_PATTERN
  }
];

const FIELD_PATTERNS: Array<{ key: keyof NodeFields; pattern: RegExp }> = [
  { key: "form_factor", pattern: /form\s*factor/i },
  { key: "cpu", pattern: /^cpu$/i },
  { key: "memory", pattern: /^memory$/i },
  { key: "os_disk", pattern: /ssd\s*disk.*\(.*os.*\)/i },
  { key: "ceph_disk", pattern: /ssd\s*disk.*ceph/i },
  { key: "nic", pattern: /^nic$/i },
  { key: "note", pattern: /^(\*\s*)?비고\s*:?$/i },
  { key: "asset_status", pattern: /^(상태|확보여부)$/i }
];

const INVALID_PARTNER_PATTERNS: RegExp[] = [
  /^\*\s*비고/i,
  /^비고\s*:?$/i,
  /필수조건/,
  /권장규격/,
  /오케스트로\s*제시/,
  /항목\s*\(?\s*1\s*식/i,
  /^spec$/i,
  /확보여부/,
  /^\d{1,2}\/\d{1,2}/,
  /확인\s*내용/,
  /안내\s*사항/,
  /고객사\s*poc/i,
  /컨트롤\s*노드/,
  /(?:컴퓨(?:터|트|팅)\s*노드|compute\s*node|computing\s*node)/i,
  /form\s*factor/i,
  /^cpu$/i,
  /^memory$/i,
  /^nic$/i,
  /ssd\s*disk/i,
  /▶/,
  /규격\s*$/,
  /^\d+$/,
  /^[a-z\s]+$/i
];

type NodeFields = {
  form_factor: string | null;
  cpu: string | null;
  memory: string | null;
  os_disk: string | null;
  ceph_disk: string | null;
  nic: string | null;
  note: string | null;
  asset_status: string | null;
};

type CellMatrix = string[][];

type PartnerBlock = {
  start_row: number;
  start_col: number;
  company_name: string;
};

export function parsePartnerEquipmentWorkbook(
  workbook: XLSX.WorkBook
): PartnerEquipmentParseResult {
  const sheetName = pickTargetSheet(workbook.SheetNames);
  const sheet = workbook.Sheets[sheetName];
  const matrix = readSheetMatrix(sheet);

  if (detectBlockLayout(sheetName)) {
    return parseBlockSheet(matrix, sheetName);
  }

  return parseVerticalSheet(workbook, sheetName);
}

function pickTargetSheet(sheetNames: string[]): string {
  if (sheetNames.length === 0) {
    throw new Error("업로드 파일에 시트가 없습니다.");
  }

  const preferred = sheetNames.find(
    (name) => normalizeHeader(name) === normalizeHeader(PREFERRED_SHEET)
  );
  if (preferred) return preferred;

  const equipmentSheet = sheetNames.find((name) => {
    const normalized = normalizeHeader(name);
    return normalized.includes("장비규격") || normalized.includes("장비");
  });

  return equipmentSheet ?? sheetNames[0];
}

function detectBlockLayout(sheetName: string): boolean {
  return normalizeHeader(sheetName).includes("장비규격");
}

function parseBlockSheet(matrix: CellMatrix, sheetName: string): PartnerEquipmentParseResult {
  const blocks = findPartnerBlocks(matrix);
  const rows: ParsedPartnerEquipmentRow[] = [];
  let rowNumber = 0;
  let skippedNodes = 0;

  for (const block of blocks) {
    const nodes = parsePartnerBlock(matrix, block);
    for (const node of nodes) {
      if (!hasNodeSpec(node)) {
        skippedNodes += 1;
        continue;
      }

      rowNumber += 1;
      rows.push({
        row_number: rowNumber,
        excluded: false,
        excluded_reason: null,
        company_name: block.company_name,
        normalized_company_name: normalizeCompanyName(block.company_name),
        asset_group: node.asset_group,
        node_type: node.node_type,
        node_name: node.node_name,
        form_factor: node.form_factor,
        cpu: node.cpu,
        memory: node.memory,
        os_disk: node.os_disk,
        ceph_disk: node.ceph_disk,
        nic: node.nic,
        asset_status: node.asset_status ?? "보유",
        asset_type: node.node_type,
        asset_name: node.node_name,
        vendor: null,
        model_name: null,
        spec_summary: buildSpecSummary(node),
        quantity: 1,
        memo: node.note,
        source_file: PARTNER_EQUIPMENT_BLOCK_SOURCE_FILE,
        warnings: node.warnings
      });
    }
  }

  const partnerCount = new Set(rows.map((row) => row.company_name)).size;

  return {
    sheet_name: sheetName,
    layout: "block",
    total_rows: rows.length,
    partner_count: partnerCount,
    excluded_count: skippedNodes,
    warning_count: rows.filter((row) => row.warnings.length > 0).length,
    rows,
    headers: [
      "company_name",
      "node_name",
      "cpu",
      "memory",
      "os_disk",
      "ceph_disk",
      "nic",
      "asset_status"
    ]
  };
}

function findPartnerBlocks(matrix: CellMatrix): PartnerBlock[] {
  const blocks: PartnerBlock[] = [];

  for (const excelRow of PARTNER_ANCHOR_ROWS) {
    const startRow = excelRow - 1;
    if (startRow < 0 || startRow >= matrix.length) continue;

    for (const startCol of BLOCK_START_COLS) {
      const companyName = stringify(matrix[startRow]?.[startCol]);
      if (!companyName || !isValidPartnerName(companyName)) continue;

      blocks.push({
        start_row: startRow,
        start_col: startCol,
        company_name: companyName
      });
    }
  }

  return blocks;
}

function isValidPartnerName(value: string): boolean {
  const text = value.trim();
  if (text.length < 2 || text.length > 24) return false;
  if (INVALID_PARTNER_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (/^\d/.test(text)) return false;
  if (/[.!?]/.test(text)) return false;
  if (/\s/.test(text) && text.length > 12) return false;
  return true;
}

function parsePartnerBlock(matrix: CellMatrix, block: PartnerBlock) {
  const endRow = findBlockEndRow(matrix, block);
  const nodes: Array<
    NodeFields & {
      node_type: string;
      node_name: string;
      asset_group: string;
      warnings: string[];
    }
  > = [];

  let current:
    | (NodeFields & {
        node_type: string;
        node_name: string;
        asset_group: string;
        warnings: string[];
      })
    | null = null;

  for (let row = block.start_row + 1; row <= endRow; row += 1) {
    const label = stringify(matrix[row]?.[block.start_col]);
    if (!label) continue;

    const nodeMatch = matchNodeDefinition(label);
    if (nodeMatch) {
      if (current) nodes.push(current);
      current = emptyNode(nodeMatch.node_type, nodeMatch.node_name);
      continue;
    }

    if (!current) continue;

    const fieldMatch = FIELD_PATTERNS.find((item) => item.pattern.test(label));
    if (!fieldMatch) continue;

    const specValue = stringify(matrix[row]?.[block.start_col + 1]);
    const memoValue = stringify(matrix[row]?.[block.start_col + 2]);

    if (fieldMatch.key === "asset_status") {
      current.asset_status = normalizeAssetStatus(specValue ?? memoValue) ?? current.asset_status;
      continue;
    }

    if (fieldMatch.key === "note") {
      current.note = [specValue, memoValue].filter(Boolean).join(" / ") || current.note;
      continue;
    }

    current[fieldMatch.key] = specValue ?? current[fieldMatch.key];
    if (memoValue) {
      const extra = `${label} 메모: ${memoValue}`;
      current.note = current.note ? `${current.note}; ${extra}` : extra;
    }
  }

  if (current) nodes.push(current);

  return nodes;
}

function matchNodeDefinition(label: string) {
  const normalized = normalizeNodeLabelForMatch(label);
  return NODE_DEFINITIONS.find((item) => item.pattern.test(normalized)) ?? null;
}

function findBlockEndRow(matrix: CellMatrix, block: PartnerBlock): number {
  for (const excelRow of PARTNER_ANCHOR_ROWS) {
    const anchorRow = excelRow - 1;
    if (anchorRow <= block.start_row) continue;

    const nextName = stringify(matrix[anchorRow]?.[block.start_col]);
    if (nextName && isValidPartnerName(nextName)) {
      return anchorRow - 1;
    }
  }

  return matrix.length - 1;
}

function emptyNode(nodeType: string, nodeName: string) {
  return {
    node_type: nodeType,
    node_name: nodeName,
    asset_group: DEFAULT_ASSET_GROUP,
    form_factor: null,
    cpu: null,
    memory: null,
    os_disk: null,
    ceph_disk: null,
    nic: null,
    note: null,
    asset_status: null,
    warnings: [] as string[]
  };
}

function hasNodeSpec(node: NodeFields): boolean {
  return [node.form_factor, node.cpu, node.memory, node.os_disk, node.ceph_disk, node.nic].some(
    (value) => !!value?.trim()
  );
}

function normalizeAssetStatus(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/보유/.test(trimmed) && !/미보유/.test(trimmed)) return "보유";
  if (/확보/.test(trimmed)) return "확보 예정";
  if (/미보유/.test(trimmed)) return "미보유";
  if (/확인/.test(trimmed)) return "확인필요";
  return trimmed;
}

function buildSpecSummary(node: NodeFields & { node_name: string }): string {
  return [
    node.form_factor,
    node.cpu,
    node.memory,
    node.os_disk ? `OS ${node.os_disk}` : null,
    node.ceph_disk ? `Ceph ${node.ceph_disk}` : null,
    node.nic
  ]
    .filter(Boolean)
    .join(" · ");
}

function readSheetMatrix(sheet: XLSX.WorkSheet): CellMatrix {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const matrix: CellMatrix = [];

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const line: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[address];
      line.push(cell == null ? "" : stringify(cell.v) ?? "");
    }
    matrix.push(line);
  }

  return matrix;
}

function parseVerticalSheet(workbook: XLSX.WorkBook, sheetName: string): PartnerEquipmentParseResult {
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true
  });

  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  const rows = json.map((row, index) => parseVerticalRow(row, index));

  return {
    sheet_name: sheetName,
    layout: "vertical",
    total_rows: rows.length,
    partner_count: new Set(rows.filter((row) => !row.excluded).map((row) => row.company_name)).size,
    excluded_count: rows.filter((row) => row.excluded).length,
    warning_count: rows.filter((row) => !row.excluded && row.warnings.length > 0).length,
    rows,
    headers
  };
}

const COMPANY_KEYS = ["파트너사", "회사명", "파트너사명", "업체명", "company", "partner"];
const TYPE_KEYS = ["장비구분", "구분", "유형", "종류", "asset_type", "type", "노드"];
const SPEC_KEYS = ["규격", "스펙", "장비규격", "규격요약", "spec", "모델", "장비명", "제품명"];
const NAME_KEYS = ["자산명", "장비명", "노드명", "name"];
const CPU_KEYS = ["cpu"];
const MEMORY_KEYS = ["memory", "메모리"];
const OS_KEYS = ["os disk", "os_disk", "osdisk"];
const CEPH_KEYS = ["ceph"];
const NIC_KEYS = ["nic"];
const STATUS_KEYS = ["상태", "장비상태", "asset_status"];
const MEMO_KEYS = ["비고", "메모", "memo", "note"];

function parseVerticalRow(row: Record<string, unknown>, index: number): ParsedPartnerEquipmentRow {
  const company_name = pickString(row, COMPANY_KEYS)?.trim() ?? "";
  const node_name = pickString(row, NAME_KEYS);
  const asset_type = pickString(row, TYPE_KEYS);
  const cpu = pickString(row, CPU_KEYS);
  const memory = pickString(row, MEMORY_KEYS);
  const os_disk = pickString(row, OS_KEYS);
  const ceph_disk = pickString(row, CEPH_KEYS);
  const nic = pickString(row, NIC_KEYS);
  const asset_status = normalizeAssetStatus(pickString(row, STATUS_KEYS));
  const spec_summary =
    pickString(row, SPEC_KEYS) ?? [cpu, memory, os_disk, ceph_disk, nic].filter(Boolean).join(" · ");
  const memo = pickString(row, MEMO_KEYS);

  if (!company_name || !isValidPartnerName(company_name)) {
    return excludedVerticalRow(index, "회사명 없음 또는 유효하지 않음");
  }

  if (!node_name && !asset_type && !spec_summary) {
    return excludedVerticalRow(index, "장비 정보 없음", company_name);
  }

  const normalizedNodeName = normalizeParsedNodeName(node_name, asset_type);
  const node_type = normalizeParsedNodeType(normalizedNodeName, asset_type);

  return {
    row_number: index + 1,
    excluded: false,
    excluded_reason: null,
    company_name,
    normalized_company_name: normalizeCompanyName(company_name),
    asset_group: DEFAULT_ASSET_GROUP,
    node_type,
    node_name: normalizedNodeName,
    form_factor: pickString(row, ["form factor", "form_factor"]),
    cpu,
    memory,
    os_disk,
    ceph_disk,
    nic,
    asset_status: asset_status ?? (hasNodeSpec({ form_factor: null, cpu, memory, os_disk, ceph_disk, nic, note: null, asset_status: null }) ? "보유" : null),
    asset_type,
    spec_summary: spec_summary || node_name,
    asset_name: node_name ?? spec_summary,
    vendor: null,
    model_name: null,
    quantity: 1,
    memo,
    source_file: "장비현황.xlsx",
    warnings: []
  };
}

function excludedVerticalRow(
  index: number,
  reason: string,
  company_name = ""
): ParsedPartnerEquipmentRow {
  return {
    row_number: index + 1,
    excluded: true,
    excluded_reason: reason,
    company_name,
    normalized_company_name: null,
    asset_group: null,
    node_type: null,
    node_name: null,
    form_factor: null,
    cpu: null,
    memory: null,
    os_disk: null,
    ceph_disk: null,
    nic: null,
    asset_status: null,
    asset_type: null,
    spec_summary: null,
    asset_name: null,
    vendor: null,
    model_name: null,
    quantity: null,
    memo: null,
    source_file: "장비현황.xlsx",
    warnings: []
  };
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const [header, value] of Object.entries(row)) {
    const normalized = normalizeHeader(header);
    if (!keys.some((key) => normalized.includes(normalizeHeader(key)))) continue;
    const text = stringify(value);
    if (text) return text;
  }
  return null;
}

function stringify(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeParsedNodeName(
  nodeName: string | null,
  assetType: string | null
): string | null {
  const candidate = nodeName ?? assetType;
  if (!candidate) return null;

  const normalized = normalizeNodeLabelForMatch(candidate);

  for (const item of NODE_DEFINITIONS) {
    if (item.pattern.test(normalized)) return item.node_name;
  }

  return candidate;
}

function normalizeParsedNodeType(
  nodeName: string | null,
  assetType: string | null
): string | null {
  if (nodeName === "컴퓨트 노드 1식") return "컴퓨트 노드";
  if (nodeName?.startsWith("컨트롤 노드")) return "컨트롤 노드";
  if (assetType?.includes("컴퓨")) return "컴퓨트 노드";
  if (assetType?.includes("컨트롤")) return "컨트롤 노드";
  return assetType;
}
