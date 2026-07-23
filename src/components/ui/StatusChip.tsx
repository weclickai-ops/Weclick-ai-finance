import { cx } from "@/lib/utils";

const MAP: Record<string, string> = {
  draft:"bg-black/5 text-muted", sent:"bg-copper-soft text-copper",
  partially_paid:"bg-amber-100 text-amber-800", paid:"bg-emerald-100 text-emerald-800",
  overdue:"bg-red-100 text-red-700", void:"bg-black/5 text-muted line-through",
  written_off:"bg-black/5 text-muted",
  pending:"bg-amber-100 text-amber-800", approved:"bg-emerald-100 text-emerald-800",
  rejected:"bg-red-100 text-red-700",
};
const LABEL: Record<string, string> = { partially_paid:"Partially paid", written_off:"Written off" };

export function StatusChip({ status }: { status: string }) {
  return <span className={cx("chip capitalize", MAP[status] ?? "bg-black/5 text-ink")}>
    {LABEL[status] ?? status}
  </span>;
}
