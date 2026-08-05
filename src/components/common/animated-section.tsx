import type { CSSProperties, ReactNode } from "react";

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms (50–80 typical) */
  delayMs?: number;
  as?: "div" | "section" | "header" | "article";
};

/**
 * Server-safe entrance animation wrapper.
 * Uses CSS only — no client JS. Honors prefers-reduced-motion via globals.css.
 */
export function AnimatedSection({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div"
}: AnimatedSectionProps) {
  const style =
    delayMs > 0
      ? ({ "--enter-delay": `${delayMs}ms` } as CSSProperties)
      : undefined;

  return (
    <Tag className={`ui-enter ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}

type StaggerContainerProps = {
  children: ReactNode;
  className?: string;
  /** Base delay before first child (ms) */
  baseDelayMs?: number;
  /** Gap between children (ms) */
  stepMs?: number;
  as?: "div" | "section";
};

/**
 * Applies increasing --enter-delay to direct children that use ui-enter / ui-enter-item.
 * Prefer wrapping each child with AnimatedSection when possible; this helper
 * sets CSS variables for children using ui-enter-item.
 */
export function StaggerContainer({
  children,
  className = "",
  baseDelayMs = 0,
  stepMs = 60,
  as: Tag = "div"
}: StaggerContainerProps) {
  return (
    <Tag
      className={`ui-stagger ${className}`.trim()}
      style={
        {
          "--stagger-base": `${baseDelayMs}ms`,
          "--stagger-step": `${stepMs}ms`
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}

type FadeSurfaceProps = {
  children: ReactNode;
  className?: string;
  /** Re-trigger key (e.g. page number) — changes remount animation via key on parent */
  surfaceKey?: string | number;
};

/** Whole-table / panel fade — not per-row. */
export function FadeSurface({ children, className = "", surfaceKey }: FadeSurfaceProps) {
  return (
    <div key={surfaceKey} className={`ui-enter-surface ${className}`.trim()}>
      {children}
    </div>
  );
}
