export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR").format(new Date(value));
}

export function normalizeBusinessNumber(value?: string | null) {
  if (!value) return null;
  return value.replace(/[^0-9]/g, "");
}

export function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
