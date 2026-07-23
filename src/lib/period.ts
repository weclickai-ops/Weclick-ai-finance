export type Period = "week" | "month" | "year";

export function startOfWeek(d = new Date()) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7;   // Monday = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x;
}
export function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0, 0, 0, 0); return x;
}
/** Indian financial year: 1 April → 31 March. This is what a CA files on. */
export function startOfFY(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const x = new Date(y, 3, 1); x.setHours(0, 0, 0, 0); return x;
}
export function endOfFY(d = new Date()) {
  const s = startOfFY(d);
  return new Date(s.getFullYear() + 1, 2, 31, 23, 59, 59);
}

export function periodStart(p: Period) {
  if (p === "week") return startOfWeek();
  if (p === "month") return startOfMonth();
  return startOfFY();
}
export function previousWindow(p: Period) {
  const from = periodStart(p);
  const prevFrom = new Date(from);
  if (p === "week") prevFrom.setDate(prevFrom.getDate() - 7);
  else if (p === "month") prevFrom.setMonth(prevFrom.getMonth() - 1);
  else prevFrom.setFullYear(prevFrom.getFullYear() - 1);
  return { from: prevFrom, to: from };
}
export function periodLabel(p: Period) {
  const from = periodStart(p);
  if (p === "month") return from.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  if (p === "year") {
    const y = from.getFullYear();
    return `FY ${y}–${String(y + 1).slice(2)} · 1 Apr ${y} to 31 Mar ${y + 1}`;
  }
  const to = new Date(from); to.setDate(to.getDate() + 6);
  const f = from.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const t = to.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${f} – ${t}`;
}
export function periodWord(p: Period) {
  return p === "year" ? "financial year" : p;
}
