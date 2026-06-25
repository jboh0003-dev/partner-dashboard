export type PartnerAsset = {
  id: string;
  partner_id: string;
  asset_type: string | null;
  asset_name: string | null;
  vendor: string | null;
  model_name: string | null;
  spec_summary: string | null;
  partner_name_raw: string | null;
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
  quantity: number | null;
  status: string | null;
  memo: string | null;
  match_status: string | null;
  source_file: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export const ASSET_NODE_ORDER = [
  "컨트롤 노드 1식",
  "컨트롤 노드 2식",
  "컨트롤 노드 3식",
  "컴퓨터 노드 1식"
] as const;

/** 파트너 상세 등 화면 표시용 컴퓨트 노드명 */
export const COMPUTE_NODE_DISPLAY_NAME = "컴퓨터 노드 1식";
