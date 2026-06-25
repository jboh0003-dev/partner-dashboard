import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox size={22} strokeWidth={1.75} />
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
