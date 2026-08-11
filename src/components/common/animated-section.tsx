import type { CSSProperties, ReactNode } from "react";
import {
  UI_ENTER_DELAY_CAP_MS,
  UI_STAGGER_STEP_CAP_MS
} from "@/lib/performance/ui-tuning";

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms */
  delayMs?: number;
  as?: "div" | "section" | "header" | "article";
};

/**
 * Server-safe entrance animation wrapper.
 * Desktop navigation should feel immediate, so stagger delays are intentionally capped.
 */
export function AnimatedSection({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div"
}: AnimatedSectionProps) {
  const effectiveDelay = Math.min(Math.max(delayMs, 0), UI_ENTER_DELAY_CAP_MS);
  const style =
    effectiveDelay > 0
      ? ({ "--enter-delay": `${effectiveDelay}ms` } as CSSProperties)
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
  baseDelayMs?: number;
  stepMs?: number;
  as?: "div" | "section";
};

export function StaggerContainer({
  children,
  className = "",
  baseDelayMs = 0,
  stepMs = 60,
  as: Tag = "div"
}: StaggerContainerProps) {
  const effectiveBase = Math.min(Math.max(baseDelayMs, 0), UI_ENTER_DELAY_CAP_MS);
  const effectiveStep = Math.min(Math.max(stepMs, 0), UI_STAGGER_STEP_CAP_MS);

  return (
    <Tag
      className={`ui-stagger ${className}`.trim()}
      style={
        {
          "--stagger-base": `${effectiveBase}ms`,
          "--stagger-step": `${effectiveStep}ms`
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
  surfaceKey?: string | number;
};

export function FadeSurface({ children, className = "", surfaceKey }: FadeSurfaceProps) {
  return (
    <div key={surfaceKey} className={`ui-enter-surface ${className}`.trim()}>
      {children}
    </div>
  );
}
