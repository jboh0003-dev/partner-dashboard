import type { PartnerAsset } from "@/types/asset";
import { normalizeAssetNodeName } from "@/lib/assets/node-utils";
import { TableText } from "@/components/common/table-cells";

type AssetNodeCardProps = {
  asset: PartnerAsset;
  displayNodeName?: string;
};

export function AssetNodeCard({ asset, displayNodeName }: AssetNodeCardProps) {
  const title =
    displayNodeName ??
    normalizeAssetNodeName(asset.node_name) ??
    asset.node_name ??
    "장비 노드";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        {asset.asset_status ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {asset.asset_status}
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <SpecItem label="Form Factor" value={asset.form_factor} />
        <SpecItem label="CPU" value={asset.cpu} />
        <SpecItem label="Memory" value={asset.memory} />
        <SpecItem label="OS Disk" value={asset.os_disk} />
        <SpecItem label="Ceph Disk" value={asset.ceph_disk} />
        <SpecItem label="NIC" value={asset.nic} />
        <SpecItem label="비고" value={asset.memo} className="sm:col-span-2" />
      </dl>
    </article>
  );
}

function SpecItem({
  label,
  value,
  className = ""
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1">
        <TableText
          value={value}
          className="block break-keep whitespace-normal text-slate-700"
        />
      </dd>
    </div>
  );
}

export function AssetNodeDetailTable({ assets }: { assets: PartnerAsset[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
      <table className="min-w-[960px] w-full divide-y divide-slate-200">
        <thead className="bg-white">
          <tr>
            {["노드명", "CPU", "Memory", "OS Disk", "Ceph Disk", "NIC", "비고"].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="min-w-[9rem] px-4 py-3 text-sm font-medium text-slate-900">
                {normalizeAssetNodeName(asset.node_name) ?? asset.node_name ?? "-"}
              </td>
              <SpecCell value={asset.cpu} minWidth="8rem" />
              <SpecCell value={asset.memory} minWidth="7rem" />
              <SpecCell value={asset.os_disk} minWidth="8rem" />
              <SpecCell value={asset.ceph_disk} minWidth="8rem" />
              <SpecCell value={asset.nic} minWidth="7rem" />
              <SpecCell value={asset.memo} minWidth="10rem" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpecCell({ value, minWidth }: { value: string | null | undefined; minWidth: string }) {
  return (
    <td className="px-4 py-3 align-top">
      <TableText
        value={value}
        className="block max-w-[18rem] break-keep whitespace-normal text-sm text-slate-700"
        style={{ minWidth } as React.CSSProperties}
      />
    </td>
  );
}
