import { cx } from "@/lib/utils";

/**
 * Real logo from /public/logo.png.
 * The artwork is dark-on-light, so on dark surfaces it sits on a light
 * chip rather than being inverted (inverting would turn the orange blue).
 */
export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <span className={cx("inline-flex items-center rounded-lg px-2 py-1.5", light && "bg-white")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="WeClick AI" className="h-5 w-auto" />
      </span>
      <span className={cx("font-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                          light ? "text-white/45" : "text-muted")}>
        Finance
      </span>
    </div>
  );
}
