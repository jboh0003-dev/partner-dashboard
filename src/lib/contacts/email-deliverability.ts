export type BounceClassification = "hard" | "soft" | "policy" | "unknown";

const HARD_BOUNCE_PATTERNS = [
  /no mailbox/i,
  /user unknown/i,
  /mailbox not found/i,
  /address rejected/i,
  /recipient address rejected/i,
  /550[\s-]?5\.1\.1/i,
  /does not exist/i,
  /unknown user/i
];

const SOFT_BOUNCE_PATTERNS = [
  /read timed out/i,
  /421 service not available/i,
  /temporar/i,
  /try again/i,
  /greylist/i,
  /4\d{2}[\s-]?/i
];

const POLICY_BOUNCE_PATTERNS = [
  /access denied/i,
  /policy blocked/i,
  /rejected due to policy/i,
  /blocked by/i,
  /spam/i,
  /blacklist/i
];

export function classifyBounceReason(reason: string | null | undefined): BounceClassification {
  const text = (reason ?? "").trim();
  if (!text) return "unknown";
  if (HARD_BOUNCE_PATTERNS.some((pattern) => pattern.test(text))) return "hard";
  if (POLICY_BOUNCE_PATTERNS.some((pattern) => pattern.test(text))) return "policy";
  if (SOFT_BOUNCE_PATTERNS.some((pattern) => pattern.test(text))) return "soft";
  return "unknown";
}

export type EmailDeliverabilityPatch = {
  is_bounced: boolean;
  is_sendable: boolean;
  retry_needed: boolean;
  bounced_at?: string | null;
  bounce_reason?: string | null;
  last_bounce_source?: string | null;
};

export function deliverabilityFromBounceReason(
  reason: string,
  source = "import"
): EmailDeliverabilityPatch {
  const classification = classifyBounceReason(reason);

  if (classification === "hard") {
    return {
      is_bounced: true,
      is_sendable: false,
      retry_needed: false,
      bounced_at: new Date().toISOString(),
      bounce_reason: reason,
      last_bounce_source: source
    };
  }

  if (classification === "soft") {
    return {
      is_bounced: false,
      is_sendable: true,
      retry_needed: true,
      bounce_reason: reason,
      last_bounce_source: source
    };
  }

  if (classification === "policy") {
    return {
      is_bounced: false,
      is_sendable: false,
      retry_needed: false,
      bounce_reason: reason,
      last_bounce_source: source
    };
  }

  return {
    is_bounced: false,
    is_sendable: true,
    retry_needed: false,
    bounce_reason: reason,
    last_bounce_source: source
  };
}

export function isEmailSendable(input: {
  is_bounced?: boolean | null;
  is_sendable?: boolean | null;
}): boolean {
  if (input.is_bounced) return false;
  return input.is_sendable !== false;
}

export const NO_SENDABLE_EMAIL_REASON = "발송 가능한 이메일 없음";
export const ALL_EMAILS_BOUNCED_REASON = "모든 이메일 반송됨";

export function resolveContactEmailReviewReason(
  emails: Array<{ is_bounced?: boolean | null; is_sendable?: boolean | null; email?: string }>
): string | null {
  const validEmails = emails.filter((row) => row.email?.trim());
  if (validEmails.length === 0) return null;

  const sendable = validEmails.filter((row) => isEmailSendable(row));
  if (sendable.length > 0) return null;

  const allBounced = validEmails.every((row) => row.is_bounced);
  return allBounced ? ALL_EMAILS_BOUNCED_REASON : NO_SENDABLE_EMAIL_REASON;
}
