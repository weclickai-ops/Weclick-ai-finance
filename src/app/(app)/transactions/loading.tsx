import { PageSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return <PageSkeleton stats={3} rows={10} action={true} />;
}
