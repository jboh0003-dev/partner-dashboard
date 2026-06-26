"use client";

import { useEffect } from "react";

type CopyToastProps = {
  message: string | null;
  tone?: "success" | "error";
  onDismiss?: () => void;
  autoHideMs?: number;
};

export function CopyToast({
  message,
  tone = "success",
  onDismiss,
  autoHideMs = 3000
}: CopyToastProps) {
  useEffect(() => {
    if (!message || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, autoHideMs]);

  if (!message) return null;

  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div
      className={`mb-3 rounded-xl border px-4 py-2.5 text-sm ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
