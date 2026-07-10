"use client";

import {
  collectDisplayRoleLabels,
  roleLabelBadgeClass
} from "@/lib/contacts/role-labels";

type ContactRoleBadgesProps = {
  labels: string[];
  maxVisible?: number;
  className?: string;
};

export function ContactRoleBadges({
  labels,
  maxVisible = 2,
  className = ""
}: ContactRoleBadgesProps) {
  const displayLabels = collectDisplayRoleLabels(labels);

  if (displayLabels.length === 0) {
    return null;
  }

  const visible = displayLabels.slice(0, maxVisible);
  const hiddenCount = displayLabels.length - visible.length;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visible.map((role) => (
        <span key={role} className={roleLabelBadgeClass(role)} title={role}>
          {role}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span
          className="text-[11px] font-medium text-slate-400"
          title={displayLabels.slice(maxVisible).join(", ")}
        >
          외 {hiddenCount}개
        </span>
      ) : null}
    </div>
  );
}
