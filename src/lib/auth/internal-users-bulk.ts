export const INTERNAL_USER_BULK_PRESET = `hj.ko2@okestro.com,admin
sh.kwon@okestro.com,viewer
ck.jeong@okestro.com,viewer
is.yoo@okestro.com,viewer
bs.han@okestro.com,viewer
sh.kim7@okestro.com,viewer
sj.shin2@okestro.com,viewer
yj.jeon@okestro.com,viewer
ks.lee2@okestro.com,viewer
mj.cho@okestro.com,viewer
kj.lee@okestro.com,viewer
s.shin@okestro.com,viewer
ok.lee@okestro.com,viewer
ks.jin@okestro.com,viewer
ps.park@okestro.com,viewer
mw.nam@okestro.com,viewer
hj.kim12@okestro.com,viewer
hs.kim4@okestro.com,viewer
sh.han@okestro.com,viewer
sh.park5@okestro.com,viewer
dh.ahn@okestro.com,viewer
cj.lee@okestro.com,viewer
sk.jeon@okestro.com,viewer
gt.jang@okestro.com,viewer
dh.kim4@okestro.com,viewer
is.kim@okestro.com,viewer
yo.cho2@okestro.com,viewer
is.jeong@okestro.com,viewer
sy.yang@okestro.com,viewer
ss.kim3@okestro.com,viewer
js.jang2@okestro.com,viewer
cs.shin@okestro.com,viewer
ih.cho2@okestro.com,viewer`;

export type BulkRole = "viewer" | "admin";

export type BulkParseRow = {
  lineNumber: number;
  raw: string;
  name: string | null;
  email: string;
  role: BulkRole;
  error: string | null;
};

export type BulkAction = "create_auth" | "create_profile" | "existing" | "error";

export type BulkClassifiedRow = BulkParseRow & {
  action: BulkAction;
  authUserId: string | null;
};

export type BulkExistingMaps = {
  authByEmail: Map<string, string>;
  profileEmails: Set<string>;
  profileIds: Set<string>;
};

const OKESTRO_SUFFIX = "@okestro.com";

export function isOkestroEmail(email: string): boolean {
  return email.toLowerCase().endsWith(OKESTRO_SUFFIX) && email.split("@").length === 2;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseRole(value: string | undefined): BulkRole | null {
  if (!value) return "viewer";
  const role = value.trim().toLowerCase();
  if (!role) return "viewer";
  if (role === "viewer" || role === "admin") return role;
  return null;
}

function isHeaderLine(parts: string[]): boolean {
  const joined = parts.join(",").replace(/\s/g, "").toLowerCase();
  return joined === "이름,이메일,역할" || joined === "이메일,역할" || joined === "email,role";
}

export function parseInternalUserBulkText(text: string): BulkParseRow[] {
  const rows: BulkParseRow[] = [];
  const seen = new Map<string, number>();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;
    const parts = raw.split(",").map((part) => part.trim());
    if (isHeaderLine(parts)) continue;

    let name: string | null = null;
    let email = "";
    let roleRaw: string | undefined;

    if (parts.length === 1) {
      email = parts[0];
    } else if (parts.length === 2) {
      if (parts[0].includes("@")) {
        email = parts[0];
        roleRaw = parts[1];
      } else {
        name = parts[0] || null;
        email = parts[1];
      }
    } else {
      name = parts[0] || null;
      email = parts[1] ?? "";
      roleRaw = parts[2];
    }

    const lineNumber = i + 1;
    const normalized = normalizeEmail(email);
    const role = parseRole(roleRaw);
    let error: string | null = null;

    if (!normalized || !normalized.includes("@")) {
      error = "이메일이 올바르지 않습니다.";
    } else if (!isOkestroEmail(normalized)) {
      error = "@okestro.com 이메일만 등록할 수 있습니다.";
    } else if (!role) {
      error = "역할은 viewer 또는 admin만 가능합니다.";
    } else if (seen.has(normalized)) {
      error = `중복 이메일입니다. (${seen.get(normalized)}행과 동일)`;
    } else {
      seen.set(normalized, lineNumber);
    }

    rows.push({
      lineNumber,
      raw,
      name: name?.trim() ? name.trim() : null,
      email: normalized,
      role: role ?? "viewer",
      error
    });
  }

  return rows;
}

export function classifyInternalUserBulkRows(
  rows: BulkParseRow[],
  existing: BulkExistingMaps
): BulkClassifiedRow[] {
  return rows.map((row) => {
    if (row.error) {
      return { ...row, action: "error", authUserId: null };
    }
    const authUserId = existing.authByEmail.get(row.email) ?? null;
    const hasProfile =
      existing.profileEmails.has(row.email) || (authUserId ? existing.profileIds.has(authUserId) : false);
    if (authUserId && hasProfile) {
      return { ...row, action: "existing", authUserId };
    }
    if (authUserId && !hasProfile) {
      return { ...row, action: "create_profile", authUserId };
    }
    return { ...row, action: "create_auth", authUserId: null };
  });
}

export function summarizeBulkRows(rows: BulkClassifiedRow[]) {
  return {
    total: rows.length,
    create_auth: rows.filter((row) => row.action === "create_auth").length,
    create_profile: rows.filter((row) => row.action === "create_profile").length,
    existing: rows.filter((row) => row.action === "existing").length,
    errors: rows.filter((row) => row.action === "error").length
  };
}
