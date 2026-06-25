import type { ReactNode } from "react";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "ui-badge-neutral",
  primary: "ui-badge-primary",
  success: "ui-badge-success",
  warning: "ui-badge-warning",
  danger: "ui-badge-danger"
};

export function Badge({
  children,
  tone = "neutral",
  className = ""
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={[TONE_CLASS[tone], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
