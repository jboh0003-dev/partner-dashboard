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
      <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-bold leading-none tabular-nums tracking-tight text-slate-950 xl:text-[1.75rem]">
        {value}
      </div>
      <div className="min-h-[14px] text-2xs text-slate-400">{hint ?? ""}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
}
