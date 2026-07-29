import { Shimmer } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Shimmer className="h-4 w-20" />
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="mx-auto max-w-[820px] rounded-xl2 border border-line bg-white p-10">
        <div className="flex justify-between">
          <div>
            <Shimmer className="h-9 w-40" />
            <Shimmer className="mt-3 h-3 w-52" />
            <Shimmer className="mt-1.5 h-3 w-40" />
          </div>
          <div className="text-right">
            <Shimmer className="ml-auto h-8 w-28" />
            <Shimmer className="ml-auto mt-2 h-3 w-24" />
          </div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-6">
          <div>
            <Shimmer className="h-3 w-16" />
            <Shimmer className="mt-2 h-4 w-36" />
            <Shimmer className="mt-1.5 h-3 w-44" />
          </div>
          <div className="justify-self-end text-right">
            <Shimmer className="h-3 w-32" />
            <Shimmer className="mt-1.5 h-3 w-28" />
          </div>
        </div>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Shimmer key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Shimmer className="h-16 w-56" />
        </div>
      </div>
    </>
  );
}
