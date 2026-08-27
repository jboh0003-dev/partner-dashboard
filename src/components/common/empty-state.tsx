import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  compact?: boolean;
};

export function EmptyState({ title, description, compact = false }: EmptyStateProps) {
  return (
    <div className={compact ? "rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center" : "ui-empty"}>
      <div
        className={
          compact
            ? "mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200"
            : "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"
        }
      >
        <Inbox size={compact ? 18 : 22} strokeWidth={1.75} />
      </div>
      <div className="text-base font-semibold text-slate-900">{title}</div>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
