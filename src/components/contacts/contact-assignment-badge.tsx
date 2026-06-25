import {
  CONTACT_ASSIGNMENT_TONE_CLASS,
  getContactAssignmentLabel,
  getContactAssignmentTone,
  type ContactAssignmentInput
} from "@/lib/contacts/display";

export function ContactAssignmentBadge({
  contact,
  className = ""
}: {
  contact: ContactAssignmentInput;
  className?: string;
}) {
  const label = getContactAssignmentLabel(contact);
  const tone = getContactAssignmentTone(contact);

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        CONTACT_ASSIGNMENT_TONE_CLASS[tone],
        className
      ].join(" ")}
    >
      {label}
    </span>
  );
}
