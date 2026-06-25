type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
      <div className="min-w-0 flex-1">
        <h1 className="ui-page-title">{title}</h1>
        {description ? <p className="ui-page-desc">{description}</p> : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
