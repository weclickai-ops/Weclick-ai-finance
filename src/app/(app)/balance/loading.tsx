import { Shimmer } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <div className="mb-5">
        <Shimmer className="h-7 w-44" />
        <Shimmer className="mt-2 h-4 w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="card p-6">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="mt-3 h-11 w-56" />
          </div>
          <div className="card p-5">
            <Shimmer className="h-4 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} className="h-5 w-full" />)}
            </div>
          </div>
        </div>
        <div className="card p-5">
          <Shimmer className="h-4 w-36" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </div>
    </>
  );
}
