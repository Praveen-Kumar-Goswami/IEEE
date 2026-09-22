const LOCALE = "en-GB";

export function formatTime(input: string | number | Date, withSeconds = false) {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(input));
}

export function formatDate(input: string | number | Date, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: style === "long" ? "numeric" : undefined,
  }).format(new Date(input));
}

export function formatDateTime(input: string | number | Date) {
  return `${formatDate(input)} · ${formatTime(input)}`;
}

export function formatWeekday(input: string | number | Date) {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" }).format(new Date(input));
}

export function formatRelative(input: string | number | Date, now = Date.now()) {
  const diff = new Date(input).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto", style: "short" });
  if (abs < 45_000) return diff <= 0 ? "just now" : "in a moment";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number, digits = 0) {
  return `${formatNumber(value, digits)}%`;
}

export function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstName(name: string) {
  return name.replace(/^Dr\.?\s+/i, "").split(/\s+/)[0] ?? name;
}

export function lastName(name: string) {
  const parts = name.replace(/^Dr\.?\s+/i, "").split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function ageFrom(dateOfBirth: string | null, now = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function humanize(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
