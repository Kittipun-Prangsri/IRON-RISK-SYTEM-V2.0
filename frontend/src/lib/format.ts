const TZ = "Asia/Bangkok";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  // A bare YYYY-MM-DD is a calendar date; pin it to noon so no timezone shifts the day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short", year: "2-digit" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: TZ, day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function nowTime(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export const fmtNum = (v: number | null | undefined, suffix = "") => (v === null || v === undefined ? "-" : `${v}${suffix}`);
