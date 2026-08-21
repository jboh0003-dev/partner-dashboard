import Image from "next/image";
import type { ReactNode } from "react";

type PageHeroProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  eyebrow?: string | null;
  prominentTitle?: boolean;
};

export function PageHero({
  title,
  description,
  action,
  children,
  compact = false,
  eyebrow = "OKESTRO Partner Portal",
  prominentTitle = false
}: PageHeroProps) {
  return (
    <section
      className={[
        "relative mb-8 overflow-hidden rounded-2xl border border-slate-200/70 shadow-elevated",
        compact ? "min-h-[120px]" : "min-h-[176px]"
      ].join(" ")}
    >
      <Image
        src="/images/okestro-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="(max-width: 1280px) 100vw, 1280px"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/72 to-okestro-800/55"
        aria-hidden
      />
      <div
        className={[
          "relative flex flex-wrap items-start justify-between gap-4",
          compact ? "px-6 py-6" : "px-8 py-9"
        ].join(" ")}
      >
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-slate-100">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={[
              "font-bold tracking-tight text-white",
              prominentTitle
                ? "text-2xl md:text-3xl"
                : compact
                  ? `${eyebrow ? "mt-1.5 " : ""}text-xl md:text-2xl`
                  : `${eyebrow ? "mt-2 " : ""}text-2xl md:text-[1.75rem]`
            ].join(" ")}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={[
                "max-w-2xl leading-relaxed text-slate-100",
                compact ? "mt-1.5 text-sm" : "mt-2 text-sm"
              ].join(" ")}
            >
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
