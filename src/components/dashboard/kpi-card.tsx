import Link from "next/link";

type KpiCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
};

export function KpiCard({ label, value, hint, href }: KpiCardProps) {
  const inner = (
    <div className="ui-kpi">
      <div className="text-sm font-semibold text-slate-800">
        {label}
      </div>
      <div className="text-3xl font-bold leading-none tabular-nums tracking-tight text-slate-950">
        {value}
      </div>
      <div className="min-h-[14px] text-2xs text-slate-400">{hint ?? ""}</div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-xl transition hover:ring-2 hover:ring-okestro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okestro-500"
      >
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
}
