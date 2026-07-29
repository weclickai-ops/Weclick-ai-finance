import { cx } from "@/lib/utils";

/**
 * Skeletons for Next's loading.tsx boundaries. Without these, clicking a tab
 * showed the previous page frozen until the server finished — which reads as
 * "nothing happened". With them the shell paints immediately and only the
 * numbers stream in.
 */

export function Shimmer({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-black/[0.06]", className)} />;
}

export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <Shimmer className="h-7 w-40" />
        <Shimmer className="mt-2 h-4 w-56" />
      </div>
      {action && <Shimmer className="h-9 w-28" />}
    </div>
  );
}

export function StatsSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card p-4">
          <Shimmer className="h-3.5 w-24" />
          <Shimmer className="mt-3 h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <Shimmer className="h-3.5 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
          <Shimmer className="h-4 flex-1" />
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({
  stats = 3,
  rows = 6,
  action = false,
}: {
  stats?: number;
  rows?: number;
  action?: boolean;
}) {
  return (
    <>
      <HeaderSkeleton action={action} />
      {stats > 0 && <StatsSkeleton n={stats} />}
      <TableSkeleton rows={rows} />
    </>
  );
}
