export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
export function money(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(n || 0);
}
export function initials(name: string | null, email: string) {
  const s = (name ?? email.split("@")[0]).trim();
  return s.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
export function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export function fmtDateFull(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
